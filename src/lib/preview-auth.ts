/**
 * Pure, fs-free session helpers for the preview login gate (spec 0036): the
 * not-yet-public area at /blog/drafts (drafts + scheduled previews) sits behind a
 * single shared password. The session is STATELESS - the cookie carries an HMAC
 * of a fixed message keyed by the password, so the Edge middleware can verify it
 * with no server-side session store (works across the blue/green rollout). Written
 * against Web Crypto (`globalThis.crypto.subtle`), so the ONE implementation runs
 * in both the Edge middleware and the Node route handler. Dependency-free and
 * I/O-free, so it is unit-tested without a server.
 */

/** The session cookie name. */
export const COOKIE_NAME = "preview_session";

/** Where an unauthenticated request is sent back to after a successful login when
 *  no (or an unsafe) `next` was supplied. */
export const DEFAULT_NEXT = "/blog/drafts";

// The signed message. A version tag lets the scheme evolve without silently
// accepting old cookies under a new format.
const SESSION_MESSAGE = "preview-authed:v1";

/** Base64url-encode raw bytes (no padding), for a URL/cookie-safe token. */
function toBase64Url(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** HMAC-SHA256(secret, msg) as a base64url string. */
async function hmac(secret: string, msg: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return toBase64Url(sig);
}

/**
 * Mint the session token for `secret` (the shared password). Deterministic - the
 * same password always yields the same token, which is the whole point: the cookie
 * is proof the holder knew the password. Returns "" for a falsy secret so a
 * misconfigured deploy cannot mint a usable session (fail-closed).
 */
export async function signSession(secret: string | undefined | null): Promise<string> {
  if (!secret) return "";
  return hmac(secret, SESSION_MESSAGE);
}

/** Constant-time string compare (no early return on the first differing char).
 *  Returns false for non-strings or differing lengths. */
function constantTimeEqual(a: unknown, b: unknown): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify a session `token` against the shared `secret`. Fail-closed: an empty
 * secret (unset `PREVIEW_PASSWORD`) or a missing/malformed token returns false.
 * Constant-time compares the presented token to the freshly recomputed expected
 * one, so a forged cookie cannot pass without knowing the password.
 */
export async function verifySession(
  token: string | undefined | null,
  secret: string | undefined | null,
): Promise<boolean> {
  if (!secret || !token) return false;
  const expected = await hmac(secret, SESSION_MESSAGE);
  return constantTimeEqual(token, expected);
}

/** True if the string carries an ASCII control char (0x00-0x1f or 0x7f), which
 *  could break the Location header on a redirect. Uses charCodeAt so no control
 *  bytes appear in this source file. */
function hasControlChar(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x20 || c === 0x7f) return true;
  }
  return false;
}

/**
 * Sanitise a `next` redirect target to a same-origin, in-app path, defusing open
 * redirects: only a path that starts with a single "/" (not "//" or "/\", which
 * browsers treat as protocol-relative) and carries no control characters is kept;
 * anything else falls back to DEFAULT_NEXT.
 */
export function safeNext(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_NEXT;
  if (!raw.startsWith("/")) return DEFAULT_NEXT;
  if (raw[1] === "/" || raw[1] === "\\") return DEFAULT_NEXT;
  if (hasControlChar(raw)) return DEFAULT_NEXT;
  return raw;
}
