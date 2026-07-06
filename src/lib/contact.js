/**
 * Pure, I/O-free core for the contact endpoint: input validation and the Resend
 * request shaping + send. Kept free of Next / request objects so it is unit-tested
 * without booting a server (the `app/v1/contact` route handler is a thin shell
 * over this - the same testable-seam pattern as `src/lib/theme.js`). No secrets
 * or PII live here: the destination address is read from env in the route and
 * passed in. The generic honeypot / same-origin / rate-limit guards live in
 * `./http-guards.js` (shared with `/v1/subscribe`, spec 0018); callers import them
 * from there directly - this module owns only the contact-specific logic.
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
