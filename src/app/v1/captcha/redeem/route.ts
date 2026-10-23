import { NextResponse } from "next/server";
import {
  CAPTCHA_SCOPE_CONTACT,
  createNonceStore,
  redeemChallenge,
} from "@/lib/captcha";
import { clientIp, createRateLimiter, isSameOrigin } from "@/lib/http-guards";
import { captureServerEvent } from "@/lib/posthog-server";

/**
 * `POST /v1/captcha/redeem` - swaps a solved Cap challenge for the single-use
 * token `/v1/contact` spends (spec 0043). Step two of the two-token flow: Cap's
 * own challenge token is verified here and never seen again, because `capjs-core`
 * exports nothing that re-verifies what it hands back. The logic lives in the
 * unit-tested `@/lib/captcha`; this handler bridges the HTTP request and reads
 * the server-only secret. Other methods 405 automatically.
 */

// Module-scoped replay guard, so a solved challenge can be redeemed exactly once
// for the life of the process (a restart just re-arms it - see `createNonceStore`).
const nonceStore = createNonceStore();

// Best-effort per-IP limiter. Matches the challenge budget: one redeem follows
// each solved challenge, so a client that stays inside the challenge limit stays
// inside this one too.
const limiter = createRateLimiter({ max: 60, windowMs: 10 * 60 * 1000 });

// The solutions array is one number per challenge (50 by default), plus the Cap
// token and the instrumentation result, so a real body is a few KB. This bounds
// the parse well clear of that.
const MAX_BODY_BYTES = 64 * 1024;

export async function POST(req: Request): Promise<Response> {
  // 1. Same-origin: this endpoint is public, so reject cross-origin drive-bys.
  if (
    !isSameOrigin(
      req.headers.get("origin"),
      req.headers.get("referer"),
      req.headers.get("host"),
    )
  ) {
    return NextResponse.json({ success: false, error: "Forbidden." }, { status: 403 });
  }

  // 2. Bound the body before buffering it (cheap DoS guard).
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { success: false, error: "Request too large." },
      { status: 413 },
    );
  }

  // 3. Rate limit, keyed on the real client IP.
  if (!limiter.check(clientIp(req))) {
    return NextResponse.json(
      { success: false, error: "Too many requests - please try again shortly." },
      { status: 429 },
    );
  }

  // 4. Parse the JSON body (malformed => 400).
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid request." },
      { status: 400 },
    );
  }

  // 5. Verify the solution and mint our token. `rejected` is the only failing
  //    verdict; `errored` means our own machinery broke, so the visitor still
  //    gets a token and the fault is raised as its own signal (spec 0043).
  const result = await redeemChallenge(process.env.CAP_SECRET, body, {
    scope: CAPTCHA_SCOPE_CONTACT,
    store: nonceStore,
  });
  if (result.status === "rejected") {
    return NextResponse.json(
      { success: false, error: "Verification failed. Please try again." },
      { status: 400 },
    );
  }
  if (result.status === "errored") {
    console.error("captcha: could not redeem a challenge:", result.error);
    captureServerEvent("captcha_unavailable", {
      reason: "redeem_failed",
      form: CAPTCHA_SCOPE_CONTACT,
    });
    if (!result.token) {
      return NextResponse.json({
        captchaUnavailable: true,
        success: false,
        error: "Captcha is unavailable.",
      });
    }
  }

  // The widget reads `expires` as an epoch timestamp and re-arms itself when the
  // token runs out, so the client and the server agree on one lifetime.
  return NextResponse.json({
    success: true,
    token: result.token,
    expires: result.expiresAtMs,
  });
}
