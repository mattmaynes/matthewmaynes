import { NextResponse } from "next/server";
import {
  createRateLimiter,
  isHoneypotFilled,
  isSameOrigin,
} from "@/lib/http-guards";
import {
  createTokenCache,
  submitSubscription,
  validateSubscribe,
} from "@/lib/subscribe";

/**
 * `POST /v1/subscribe` - adds a blog reader's email to the "Matthew Maynes Blog"
 * list in Constant Contact, without ever exposing the OAuth credentials to the
 * client. The `/v1/` prefix versions the contract. All the logic lives in the
 * pure, unit-tested `@/lib/subscribe` (+ shared guards in `@/lib/http-guards`);
 * this handler only bridges the HTTP request to it, reads server-only secrets, and
 * maps outcomes to status codes. Other methods 405 automatically (only POST is
 * exported).
 */

// Best-effort per-IP limiter, module-scoped so it persists across requests in the
// one long-lived server process: 5 subscribes / 10 min per IP (mirrors contact).
const limiter = createRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });

// Module-scoped access-token cache: mint a 24h Constant Contact token once and
// reuse it across requests until shortly before expiry (spec 0018). Persists for
// the life of the process; a deploy/restart just re-mints.
const tokenCache = createTokenCache();

// Reject bodies larger than this before parsing. The payload is a single email
// (cap 200 chars) plus the honeypot, so this is generous headroom yet bounds the
// parse.
const MAX_BODY_BYTES = 8 * 1024;

function clientIp(req: Request): string {
  // Our Caddy reverse proxy APPENDS the real client IP as the LAST X-Forwarded-For
  // entry, so any client-supplied (spoofable) values sit earlier - take the last
  // entry, not the first, or a bot could rotate a forged prefix past the limiter.
  const fwd = req.headers.get("x-forwarded-for");
  if (!fwd) return "unknown";
  const parts = fwd.split(",");
  return parts[parts.length - 1]?.trim() || "unknown";
}

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

  // 2. Bound the body before buffering it (cheap DoS guard).
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "Request too large." }, { status: 413 });
  }

  // 3. Parse the JSON body (malformed => 400).
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }
  const input = (typeof body === "object" && body !== null ? body : {}) as Record<
    string,
    unknown
  >;

  // 4. Honeypot: a filled hidden field means a bot - drop silently, report 200 so
  //    it learns nothing.
  if (isHoneypotFilled(input.company)) {
    return NextResponse.json({ ok: true });
  }

  // 5. Validate + normalize.
  const result = validateSubscribe(input);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  // 6. Rate limit, keyed on the real client IP. Counts every valid, same-origin
  //    attempt that reaches here (honeypot/invalid requests returned earlier).
  if (!limiter.check(clientIp(req))) {
    return NextResponse.json(
      { ok: false, error: "Too many requests - please try again shortly." },
      { status: 429 },
    );
  }

  // 7. Config from server-only env. Missing => fail closed, never leak which.
  const clientId = process.env.CTCT_CLIENT_ID;
  const refreshToken = process.env.CTCT_REFRESH_TOKEN;
  const listId = process.env.CTCT_LIST_ID;
  if (!clientId || !refreshToken || !listId) {
    console.error(
      "subscribe: CTCT_CLIENT_ID, CTCT_REFRESH_TOKEN and/or CTCT_LIST_ID are not set; cannot subscribe.",
    );
    return NextResponse.json(
      { ok: false, error: "Sorry, subscribing is unavailable right now." },
      { status: 500 },
    );
  }

  // 8. Submit to Constant Contact (refresh-cached token -> sign_up_form). The
  //    optional name (spec 0018 amendment) is split into first/last name in the lib.
  try {
    await submitSubscription(
      {
        email: result.data.email,
        name: result.data.name,
        clientId,
        refreshToken,
        listIds: [listId],
      },
      { cache: tokenCache },
    );
  } catch (err) {
    console.error("subscribe: Constant Contact submission failed:", err);
    return NextResponse.json(
      { ok: false, error: "Sorry, subscribing failed. Please try again later." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
