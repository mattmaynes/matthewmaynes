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

/** 303-redirect back to the login screen with a generic error, preserving `next`. */
function fail(req: Request, next: string): Response {
  const url = new URL("/login", req.url);
  url.searchParams.set("error", "1");
  url.searchParams.set("next", safeNext(next));
  return NextResponse.redirect(url, 303);
}

export async function POST(req: Request): Promise<Response> {
  // 1. Same-origin: reject cross-origin drive-by POSTs.
  if (
    !isSameOrigin(
      req.headers.get("origin"),
      req.headers.get("referer"),
      req.headers.get("host"),
    )
  ) {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  // 2. Bound the body before buffering it.
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "Request too large." }, { status: 413 });
  }

  // 3. Parse the form body (malformed => back to login with a generic error).
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail(req, DEFAULT_NEXT);
  }
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? DEFAULT_NEXT);

  // 4. Rate limit, keyed on the real client IP.
  if (!limiter.check(clientIp(req))) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts - please try again shortly." },
      { status: 429 },
    );
  }

  // 5. Verify the password constant-time (fail-closed if PREVIEW_PASSWORD unset).
  //    Comparing the HMAC of the submitted password to the HMAC of the real one
  //    reuses the pure core's constant-time check and never logs the password.
  const secret = process.env.PREVIEW_PASSWORD;
  const ok = await verifySession(await signSession(password), secret);
  if (!ok) return fail(req, next);

  // 6. Success: set the session cookie and 303-redirect to the safe target.
  const res = NextResponse.redirect(new URL(safeNext(next), req.url), 303);
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
