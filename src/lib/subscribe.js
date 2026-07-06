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
 * @typedef {{ email: string, name: string }} SubscribeData
 * @typedef {{ ok: true, data: SubscribeData } | { ok: false, error: string }} SubscribeValidation
 * @typedef {{ firstName?: string, lastName?: string }} NameParts
 * @typedef {{ clientId: string, refreshToken: string, listId: string }} CtctCreds
 */

// Field length caps, so a payload can't be unbounded. `email`/`name` bound the
// raw inputs; `part` is the Constant Contact first_name/last_name field limit, so
// a split part never overflows the API.
export const SUBSCRIBE_LIMITS = { email: 200, name: 100, part: 50 };

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
 * basic shape, and enforces the length cap. The `name` is OPTIONAL (spec 0018
 * amendment): trimmed and length-capped, but never required - a missing/empty name
 * still validates and subscribes exactly as before.
 * @param {{ email?: unknown, name?: unknown }} input
 * @returns {SubscribeValidation}
 */
export function validateSubscribe(input) {
  const email = typeof input.email === "string" ? input.email.trim() : "";
  if (!email || email.length > SUBSCRIBE_LIMITS.email || !EMAIL_RE.test(email))
    return { ok: false, error: "Please enter a valid email address." };
  const name =
    typeof input.name === "string"
      ? input.name.trim().slice(0, SUBSCRIBE_LIMITS.name)
      : "";
  return { ok: true, data: { email, name } };
}

/**
 * Split an optional free-text name into Constant Contact first/last name parts
 * (spec 0018 amendment). Low-friction single field: the FIRST whitespace-separated
 * token is the first name and the remainder (if any) the last name; a middle name
 * folds into the last name, which is fine. Trims, collapses internal whitespace,
 * caps each part at the Constant Contact field limit, and omits empty parts - so
 * an empty name yields `{}` and adds nothing to the payload.
 * @param {unknown} name
 * @returns {NameParts}
 */
export function splitName(name) {
  const norm = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (!norm) return {};
  const sp = norm.indexOf(" ");
  const first = (sp === -1 ? norm : norm.slice(0, sp)).slice(
    0,
    SUBSCRIBE_LIMITS.part,
  );
  const rest = sp === -1 ? "" : norm.slice(sp + 1).slice(0, SUBSCRIBE_LIMITS.part);
  /** @type {NameParts} */
  const parts = {};
  if (first) parts.firstName = first;
  if (rest) parts.lastName = rest;
  return parts;
}

/**
 * Shape a validated email into a Constant Contact `sign_up_form` body.
 * `create_source: "Contact"` marks it as a visitor self-signup (contrast the
 * one-off manual `"Account"` bootstrap). The list id is supplied by the caller
 * from env and never hard-coded here. Optional `first_name`/`last_name` (spec 0018
 * amendment) are added ONLY when present, so a nameless signup produces the exact
 * same payload as before.
 * @param {string} email
 * @param {string} listId
 * @param {NameParts} [nameParts]
 * @returns {{ email_address: string, create_source: "Contact", list_memberships: string[], first_name?: string, last_name?: string }}
 */
export function buildSignUpPayload(email, listId, nameParts = {}) {
  const payload = {
    email_address: email,
    create_source: "Contact",
    list_memberships: [listId],
  };
  if (nameParts.firstName) payload.first_name = nameParts.firstName;
  if (nameParts.lastName) payload.last_name = nameParts.lastName;
  return payload;
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
 * non-2xx. Optional `nameParts` (spec 0018 amendment) become first/last name on the
 * contact. `fetchImpl` is injectable for tests.
 * @param {{ accessToken: string, email: string, listId: string, nameParts?: NameParts }} args
 * @param {typeof fetch} [fetchImpl]
 */
export async function addContactToList(
  { accessToken, email, listId, nameParts },
  fetchImpl = fetch,
) {
  const res = await fetchImpl(SIGNUP_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(buildSignUpPayload(email, listId, nameParts)),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    // Do NOT fold the response body into the error: sign_up_form 4xx bodies can
    // echo the submitted email_address, and the route logs thrown errors - that
    // would leak a subscriber's email into container logs. Status only. Attach it
    // as `err.status` so callers can branch (e.g. self-heal on a stale-token 401).
    const err = new Error(`Constant Contact sign_up_form responded ${res.status}`);
    err.status = res.status;
    throw err;
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
  /** @type {Promise<string> | null} in-flight mint, shared by concurrent callers */
  let inflight = null;
  return {
    /**
     * @param {{ clientId: string, refreshToken: string }} creds
     * @param {typeof fetch} [fetchImpl]
     * @returns {Promise<string>} a valid bearer access token
     */
    getAccessToken(creds, fetchImpl = fetch) {
      if (cached && now() < cached.expiresAtMs)
        return Promise.resolve(cached.token);
      // Memoize the in-flight refresh so a cold-cache burst shares ONE mint
      // instead of each concurrent caller hitting the auth server. Cleared in
      // `finally` so a failed mint does not wedge the cache (the next call retries).
      if (!inflight) {
        inflight = refreshAccessToken(creds, fetchImpl)
          .then(({ accessToken, expiresInSec }) => {
            cached = {
              token: accessToken,
              expiresAtMs: now() + (expiresInSec - EXPIRY_SKEW_SEC) * 1000,
            };
            return accessToken;
          })
          .finally(() => {
            inflight = null;
          });
      }
      return inflight;
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
 * The optional `name` (spec 0018 amendment) is split into first/last name here and
 * stored on the contact; an empty/absent name adds nothing to the payload.
 * @param {{ email: string, name?: string } & CtctCreds} args
 * @param {{ fetchImpl?: typeof fetch, cache: ReturnType<typeof createTokenCache> }} deps
 */
export async function submitSubscription(
  { email, name, clientId, refreshToken, listId },
  { fetchImpl = fetch, cache },
) {
  const creds = { clientId, refreshToken };
  const nameParts = splitName(name);
  const accessToken = await cache.getAccessToken(creds, fetchImpl);
  try {
    await addContactToList({ accessToken, email, listId, nameParts }, fetchImpl);
  } catch (err) {
    // A cached access token can be invalidated upstream before its computed TTL
    // (revocation, >60s clock skew, or an early Constant Contact expiry). Rather
    // than 500ing every subscribe until the process restarts, self-heal once:
    // drop the stale token, mint a fresh one, and retry the add a single time.
    if (err && err.status === 401) {
      cache.clear();
      const fresh = await cache.getAccessToken(creds, fetchImpl);
      await addContactToList(
        { accessToken: fresh, email, listId, nameParts },
        fetchImpl,
      );
      return;
    }
    throw err;
  }
}
