import { NextResponse } from "next/server";
import { CAPTCHA_SCOPE_CONTACT, issueChallenge } from "@/lib/captcha";
import { clientIp, createRateLimiter, isSameOrigin } from "@/lib/http-guards";
import { captureServerEvent } from "@/lib/posthog-server";

/**
 * `POST /v1/captcha/challenge` - hands the visitor's browser a Cap challenge to
 * solve (spec 0043). Step one of the two-token flow: this mints a Cap challenge
 * token, `POST /v1/captcha/redeem` swaps a solved challenge for OUR single-use
 * token, and `POST /v1/contact` spends it. The `/v1/` prefix versions the
 * contract. The logic lives in the unit-tested `@/lib/captcha`; this handler
 * bridges the HTTP request and reads the server-only secret. Other methods 405
 * automatically (only POST is exported).
 */

// Best-effort per-IP limiter, module-scoped so it persists across requests.
// Looser than the send limits: minting a challenge is cheap for us and expensive
// for the client, and a visitor legitimately fetches several (the widget solves
// speculatively, and a token expiry re-arms it), so this only clips a flood.
const limiter = createRateLimiter({ max: 60, windowMs: 10 * 60 * 1000 });

export async function POST(req: Request): Promise<Response> {
  // 1. Same-origin: this endpoint is public, so reject cross-origin drive-bys.
  if (
    !isSameOrigin(
      req.headers.get("origin"),
      req.headers.get("referer"),
      req.headers.get("host"),
    )
  ) {
    return NextResponse.json({ ok: false, error: "Forbidden." }, { status: 403 });
  }

  // 2. Rate limit, keyed on the real client IP.
  if (!limiter.check(clientIp(req))) {
    return NextResponse.json(
      { ok: false, error: "Too many requests - please try again shortly." },
      { status: 429 },
    );
  }

  // 3. Mint the challenge. A missing secret (or a generation failure the pow-only
  //    fallback could not rescue) is OUR fault, not the visitor's, so it is loud
  //    on the server and quiet in the UI: the client reads `captchaUnavailable`
  //    and drops the control rather than blocking Send behind a check that cannot
  //    run. `/v1/contact` reaches the same verdict independently and lets the
  //    submission through, so nobody's message is lost to a broken captcha.
  const issued = await issueChallenge(process.env.CAP_SECRET, {
    scope: CAPTCHA_SCOPE_CONTACT,
  });
  if (issued.status === "errored") {
    console.error("captcha: could not issue a challenge:", issued.error);
    captureServerEvent("captcha_unavailable", {
      reason: "challenge_failed",
      form: CAPTCHA_SCOPE_CONTACT,
    });
    return NextResponse.json({
      captchaUnavailable: true,
      error: "Captcha is unavailable.",
    });
  }

  // 4. The challenge was served, but without the browser-instrumentation layer
  //    (see `issueChallenge`). Proof-of-work still gates the form, so this is a
  //    degradation to raise, not an outage to report to the visitor.
  if (issued.instrumentationError) {
    console.error(
      "captcha: instrumentation unavailable, serving a proof-of-work-only challenge:",
      issued.instrumentationError,
    );
    captureServerEvent("captcha_unavailable", {
      reason: "instrumentation_failed",
      form: CAPTCHA_SCOPE_CONTACT,
    });
  }

  return NextResponse.json(issued.challenge);
}
