/**
 * Generic, request-agnostic HTTP spam/abuse guards shared by the public POST
 * endpoints (`/v1/contact`, `/v1/subscribe`): a honeypot check, a scheme-agnostic
 * same-origin check, and a best-effort in-memory per-key rate limiter. These carry
 * no feature-specific assumptions, so both the contact and subscribe cores import
 * them from here rather than duplicating (spec 0018 extraction). Pure and I/O-free
 * (the limiter's clock is injectable), so they are unit-tested without a server.
 */

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
 * shared across replicas - which is fine for a low-traffic personal site: it thins
 * bursts, it is not a hard quota. `now` is injectable so the window logic is
 * unit-testable without a real clock.
 * @param {{ max: number, windowMs: number, maxKeys?: number }} opts
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
