import { NextResponse } from "next/server";
import { createRateLimiter, isSameOrigin } from "@/lib/http-guards";
import {
  COOKIE_NAME,
  DEFAULT_NEXT,
  safeNext,
  signSession,
  verifySession,
} from "@/lib/preview-auth";

/**
 * `POST /v1/login` - verifies the shared preview password (spec 0036) and, on
 * success, sets the stateless HMAC session cookie the middleware checks. The
 * `/v1/` prefix versions the contract. Verification logic lives in the pure,
 * unit-tested `@/lib/preview-auth`; the shared spam guards in `@/lib/http-guards`;
 * this handler only bridges the HTTP form POST, reads the server-only password,
 * and maps outcomes to redirects. Other methods 405 automatically.
 */

// Best-effort per-IP limiter, module-scoped so it persists across requests: 10
// attempts / 10 min per IP - enough for a fat-fingered owner, a speed bump for a
// guesser (the password itself is the real control).
const limiter = createRateLimiter({ max: 10, windowMs: 10 * 60 * 1000 });

const MAX_BODY_BYTES = 8 * 1024;

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function clientIp(req: Request): string {
  // Caddy appends the real client IP as the LAST X-Forwarded-For entry (see
  // /v1/subscribe), so take the last, not the first, or a forged prefix slips past.
  const fwd = req.headers.get("x-forwarded-for");
  if (!fwd) return "unknown";
  const parts = fwd.split(",");
  return parts[parts.length - 1]?.trim() || "unknown";
}

/**
 * A 303 redirect with a RELATIVE Location. Behind the Caddy proxy `req.url`'s host
 * is the container's internal bind (0.0.0.0:3000), so building an ABSOLUTE redirect
 * from it (`new URL(path, req.url)`) sends the browser to an unreachable
 * 0.0.0.0:3000 URL (feedback 0021). A relative Location is resolved by the browser
 * against the public origin it actually connected to, so it is proxy-correct with
 * no host-header trust. `safeNext` still constrains the target to a same-origin path.
 */
function seeOther(location: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: location } });
}

/**
 * Redirect back to the login screen with a generic error, preserving `next`.
 * A plain form POST should always land on a rendered page, not a JSON body. The
 * `code` picks the (generic) message: "rate" for the limiter, "1" for everything
 * else (wrong/malformed/cross-origin) - no info leak either way.
 */
function fail(next: string, code: "1" | "rate" = "1"): NextResponse {
  return seeOther(`/login?error=${code}&next=${encodeURIComponent(safeNext(next))}`);
}

export async function POST(req: Request): Promise<Response> {
  // 1. Same-origin: reject cross-origin drive-by POSTs. Back to the login page
  //    (generic error) rather than a JSON body - this is a browser form POST.
  if (
    !isSameOrigin(
      req.headers.get("origin"),
      req.headers.get("referer"),
      req.headers.get("host"),
    )
  ) {
    return fail(DEFAULT_NEXT);
  }

  // 2. Bound the body before buffering it (abuse path - a bare 413 is fine here).
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "Request too large." }, { status: 413 });
  }

  // 3. Parse the form body (malformed => back to login with a generic error).
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(DEFAULT_NEXT);
  }
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? DEFAULT_NEXT);

  // 4. Rate limit, keyed on the real client IP -> back to login with the "rate"
  //    message so the user knows to wait, not a JSON 429.
  if (!limiter.check(clientIp(req))) {
    return fail(next, "rate");
  }

  // 5. Verify the password constant-time (fail-closed if PREVIEW_PASSWORD unset).
  //    Comparing the HMAC of the submitted password to the HMAC of the real one
  //    reuses the pure core's constant-time check and never logs the password.
  const secret = process.env.PREVIEW_PASSWORD;
  const ok = await verifySession(await signSession(password), secret);
  if (!ok) return fail(next);

  // 6. Success: set the session cookie and 303-redirect to the safe (relative)
  //    target, so the browser lands on the public origin, not 0.0.0.0:3000.
  const res = seeOther(safeNext(next));
  res.cookies.set({
    name: COOKIE_NAME,
    value: await signSession(secret),
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
