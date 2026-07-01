/**
 * Pure, I/O-free core for the contact endpoint: input validation, the honeypot
 * and same-origin spam checks, an in-memory rate limiter, and the Resend request
 * shaping + send. Kept free of Next / request objects so it is unit-tested
 * without booting a server (the `app/v1/contact` route handler is a thin shell
 * over this - the same testable-seam pattern as `src/lib/theme.js`). No secrets
 * or PII live here: the destination address is read from env in the route and
 * passed in.
 *
 * @typedef {{ name: string, email: string, message: string }} ContactData
 * @typedef {{ ok: true, data: ContactData } | { ok: false, error: string }} ValidationResult
 * @typedef {{ from: string, to: string, reply_to: string, subject: string, text: string }} ResendPayload
 */

/** Field length caps, so a payload can't be unbounded. */
export const LIMITS = { name: 100, email: 200, message: 5000 };

// Deliberately loose: one @, a dot in the domain, no whitespace. This gates
// obvious garbage, not RFC-perfect addresses - the reply proves it anyway.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate + normalize a raw submission. Trims strings, requires name/email/
 * message, checks a basic email shape, and enforces the length caps.
 * @param {{ name?: unknown, email?: unknown, message?: unknown }} input
 * @returns {ValidationResult}
 */
export function validateContact(input) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const message = typeof input.message === "string" ? input.message.trim() : "";

  if (!name) return { ok: false, error: "Please enter your name." };
  if (name.length > LIMITS.name)
    return { ok: false, error: "That name is too long." };
  if (!email || email.length > LIMITS.email || !EMAIL_RE.test(email))
    return { ok: false, error: "Please enter a valid email address." };
  if (!message) return { ok: false, error: "Please enter a message." };
  if (message.length > LIMITS.message)
    return { ok: false, error: "That message is too long." };

  return { ok: true, data: { name, email, message } };
}

/**
 * The honeypot is a hidden field a real user never sees or fills; a naive bot
 * that fills every input trips it. A filled honeypot means "drop silently".
 * @param {unknown} value
 * @returns {boolean}
 */
export function isHoneypotFilled(value) {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Same-origin check by host (scheme-agnostic, so the Caddy https<->http proxy
 * hop does not trip it, and it needs no configured origin - it compares against
 * the Host the request actually arrived on). A request with neither Origin nor
 * Referer is rejected: a browser form POST always carries one; a drive-by script
 * often does not. Forgeable, so this thins drive-by spam - it is not a security
 * boundary (the honeypot + rate limit are the real guards).
 * @param {string | null} origin - the `Origin` header
 * @param {string | null} referer - the `Referer` header
 * @param {string | null} host - the `Host` header
 * @returns {boolean}
 */
export function isSameOrigin(origin, referer, host) {
  if (!host) return false;
  const src = origin ?? referer;
  if (!src) return false;
  try {
    return new URL(src).host === host;
  } catch {
    return false;
  }
}

/**
 * Best-effort in-process rate limiter: at most `max` hits per `windowMs` per key
 * (client IP). Single-container by design - state is lost on restart and is not
 * shared across replicas - which is fine for a low-traffic personal contact form
 * (spec 0008): it thins bursts, it is not a hard quota. `now` is injectable so
 * the window logic is unit-testable without a real clock.
 * @param {{ max: number, windowMs: number }} opts
 */
export function createRateLimiter({ max, windowMs, maxKeys = 10_000 }) {
  /** @type {Map<string, number[]>} key -> recent hit timestamps */
  const hits = new Map();
  return {
    /**
     * @param {string} key
     * @param {number} [now]
     * @returns {boolean} true if allowed, false if over the limit
     */
    check(key, now = Date.now()) {
      const cutoff = now - windowMs;
      // Opportunistic sweep so the Map cannot grow without bound from one-off
      // keys that are never re-checked: once it is large, evict every key with
      // no in-window hits. Only runs on the rare oversized-map path, so the
      // common case stays O(1). (The key is the real client IP - see the route -
      // so distinct keys are bounded by real visitors, and a deploy restarts the
      // process anyway; this is the backstop.)
      if (hits.size > maxKeys) {
        for (const [k, ts] of hits) {
          if (!ts.some((t) => t > cutoff)) hits.delete(k);
        }
      }
      const recent = (hits.get(key) ?? []).filter((t) => t > cutoff);
      if (recent.length >= max) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
  };
}

/**
 * Shape a validated submission into a Resend `POST /emails` body. The visitor's
 * address is the `reply_to`, so replying in the inbox reaches them; the private
 * destination (`to`) and verified sender (`from`) are supplied by the caller
 * from env and never hard-coded here.
 * @param {ContactData & { to: string, from: string }} args
 * @returns {ResendPayload}
 */
export function buildResendPayload({ name, email, message, to, from }) {
  return {
    from,
    to,
    reply_to: email,
    // Collapse control chars (incl. CR/LF) in the single-line subject so a
    // crafted name can't smuggle structure into it - defense in depth; Resend's
    // JSON API already escapes values and builds the MIME headers itself.
    subject: `Contact form: ${singleLine(name)}`,
    text: `From: ${name} <${email}>\n\n${message}`,
  };
}

/** Collapse runs of control characters to a single space and trim. */
function singleLine(value) {
  return value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
}

/**
 * POST the message to Resend. Throws on a non-2xx so the route returns a generic
 * 500. `fetchImpl` is injectable so the send path is unit-tested without a real
 * network call.
 * @param {ResendPayload} payload
 * @param {string} apiKey
 * @param {typeof fetch} [fetchImpl]
 */
export async function sendViaResend(payload, apiKey, fetchImpl = fetch) {
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    // Bound the upstream call so a stalled Resend can't hang the request
    // (learnings: best-effort network calls must be time-bounded).
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend responded ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res;
}
