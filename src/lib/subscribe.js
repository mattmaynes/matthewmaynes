/**
 * Pure, I/O-free core for the blog subscribe endpoint (spec 0018): email
 * validation, the Constant Contact request shaping, the OAuth refresh-token ->
 * access-token exchange, the add-contact call, and a small in-memory access-token
 * cache. Kept free of Next / request objects so it is unit-tested without booting
 * a server (the `app/v1/subscribe` route handler is a thin shell over this - the
 * same testable-seam pattern as `src/lib/contact.js`). No secrets live here: the
 * Constant Contact client id, refresh token, and list id are read from env in the
 * route and passed in. `fetch` and `now` are injectable so the network and clock
 * are mocked in tests. The generic honeypot / same-origin / rate-limit guards live
 * in `./http-guards.js` and are used directly by the route.
 *
 * @typedef {{ email: string }} SubscribeData
 * @typedef {{ ok: true, data: SubscribeData } | { ok: false, error: string }} SubscribeValidation
 * @typedef {{ clientId: string, refreshToken: string, listId: string }} CtctCreds
 */

/** Field length cap, so a payload can't be unbounded. */
export const SUBSCRIBE_LIMITS = { email: 200 };

// Same deliberately-loose shape as the contact core: one @, a dot in the domain,
// no whitespace. Gates obvious garbage, not RFC-perfect addresses.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Constant Contact v3 endpoints. The token endpoint is the device-flow app's
// public-client token exchange (no client secret); the sign_up_form endpoint is
// create-or-update, so a repeat email succeeds rather than erroring.
const TOKEN_URL =
  "https://authz.constantcontact.com/oauth2/default/v1/token";
const SIGNUP_URL = "https://api.cc.email/v3/contacts/sign_up_form";

// Refresh a bit before the token actually expires so an in-flight request never
// races the boundary and 401s.
const EXPIRY_SKEW_SEC = 60;

/**
 * Validate + normalize a raw submission. Trims the email, requires it, checks a
 * basic shape, and enforces the length cap.
 * @param {{ email?: unknown }} input
 * @returns {SubscribeValidation}
 */
export function validateSubscribe(input) {
  const email = typeof input.email === "string" ? input.email.trim() : "";
  if (!email || email.length > SUBSCRIBE_LIMITS.email || !EMAIL_RE.test(email))
    return { ok: false, error: "Please enter a valid email address." };
  return { ok: true, data: { email } };
}

/**
 * Shape a validated email into a Constant Contact `sign_up_form` body.
 * `create_source: "Contact"` marks it as a visitor self-signup (contrast the
 * one-off manual `"Account"` bootstrap). The list id is supplied by the caller
 * from env and never hard-coded here.
 * @param {string} email
 * @param {string} listId
 * @returns {{ email_address: string, create_source: "Contact", list_memberships: string[] }}
 */
export function buildSignUpPayload(email, listId) {
  return {
    email_address: email,
    create_source: "Contact",
    list_memberships: [listId],
  };
}

/**
 * Exchange the long-lived (non-rotating) refresh token for a 24h bearer access
 * token. Public client, so no client secret is sent. Throws on a non-2xx so the
 * route returns a generic 500. `fetchImpl` is injectable for tests.
 * @param {{ clientId: string, refreshToken: string }} creds
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{ accessToken: string, expiresInSec: number }>}
 */
export async function refreshAccessToken(
  { clientId, refreshToken },
  fetchImpl = fetch,
) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
  });
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
    // Bound the upstream call so a stalled auth server can't hang the request
    // (learnings: best-effort network calls must be time-bounded).
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Constant Contact token responded ${res.status}: ${detail.slice(0, 200)}`,
    );
  }
  const json = await res.json();
  if (!json || typeof json.access_token !== "string")
    throw new Error("Constant Contact token response missing access_token");
  return {
    accessToken: json.access_token,
    // Default to 24h if the field is absent, minus the skew applied by the cache.
    expiresInSec:
      typeof json.expires_in === "number" ? json.expires_in : 86_400,
  };
}

/**
 * Add (or update) a contact on the target list via `sign_up_form`. Throws on a
 * non-2xx. `fetchImpl` is injectable for tests.
 * @param {{ accessToken: string, email: string, listId: string }} args
 * @param {typeof fetch} [fetchImpl]
 */
export async function addContactToList(
  { accessToken, email, listId },
  fetchImpl = fetch,
) {
  const res = await fetchImpl(SIGNUP_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(buildSignUpPayload(email, listId)),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Constant Contact sign_up_form responded ${res.status}: ${detail.slice(0, 200)}`,
    );
  }
  return res;
}

/**
 * A tiny in-memory access-token cache. Mints a token on the first call, then
 * reuses it until shortly before expiry, so a burst of submits does not hammer
 * the auth server. Safe because the refresh token is non-rotating - a refresh
 * yields a new access token but the same refresh token, so there is nothing to
 * persist. Single-process by design (module-scoped in the route); a restart just
 * re-mints. `now` is injectable so expiry is unit-testable without a real clock.
 * @param {() => number} [now] - returns epoch ms
 */
export function createTokenCache(now = Date.now) {
  /** @type {{ token: string, expiresAtMs: number } | null} */
  let cached = null;
  return {
    /**
     * @param {{ clientId: string, refreshToken: string }} creds
     * @param {typeof fetch} [fetchImpl]
     * @returns {Promise<string>} a valid bearer access token
     */
    async getAccessToken(creds, fetchImpl = fetch) {
      if (cached && now() < cached.expiresAtMs) return cached.token;
      const { accessToken, expiresInSec } = await refreshAccessToken(
        creds,
        fetchImpl,
      );
      cached = {
        token: accessToken,
        expiresAtMs: now() + (expiresInSec - EXPIRY_SKEW_SEC) * 1000,
      };
      return accessToken;
    },
    /** Test/reset helper: drop any cached token. */
    clear() {
      cached = null;
    },
  };
}

/**
 * Orchestrate a subscription: get (cached or fresh) access token, then add the
 * contact to the list. Throws on any non-2xx so the route maps it to a generic
 * 500. The `cache` is supplied by the route (module-scoped) so it persists across
 * requests; `fetchImpl` is injectable for tests.
 * @param {{ email: string } & CtctCreds} args
 * @param {{ fetchImpl?: typeof fetch, cache: ReturnType<typeof createTokenCache> }} deps
 */
export async function submitSubscription(
  { email, clientId, refreshToken, listId },
  { fetchImpl = fetch, cache },
) {
  const accessToken = await cache.getAccessToken(
    { clientId, refreshToken },
    fetchImpl,
  );
  await addContactToList({ accessToken, email, listId }, fetchImpl);
}
