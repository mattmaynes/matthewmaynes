import { NextResponse } from "next/server";
import {
  createRateLimiter,
  isHoneypotFilled,
  isSameOrigin,
} from "@/lib/http-guards";
import {
  buildResendPayload,
  sendViaResend,
  validateContact,
} from "@/lib/contact";

/**
 * `POST /v1/contact` - relays a contact-form submission to the site owner by
 * email (via Resend) without ever exposing the destination address to the
 * client. The `/v1/` prefix versions the contract. All the logic lives in the
 * pure, unit-tested `@/lib/contact`; this handler only bridges the HTTP request
 * to it, reads server-only secrets, and maps outcomes to status codes. Other
 * methods 405 automatically (only POST is exported).
 */

// Best-effort per-IP limiter, module-scoped so it persists across requests in
// the one long-lived server process: 5 sends / 10 min per IP (spec 0008).
const limiter = createRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });

// Reject bodies larger than this before parsing (message cap is 5000 chars; this
// leaves generous headroom for UTF-8 + the other fields yet bounds the parse).
const MAX_BODY_BYTES = 32 * 1024;

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

  // 2. Bound the body before buffering it (cheap DoS guard). Content-Length can
  //    be absent/forged, but the field length caps below are the real limit; this
  //    just rejects the obvious oversized case early.
  const declaredLength = Number(req.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "Message too large." }, { status: 413 });
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

  // 4. Honeypot: a filled hidden field means a bot - drop silently, report 200
  //    so it learns nothing.
  if (isHoneypotFilled(input.company)) {
    return NextResponse.json({ ok: true });
  }

  // 5. Validate + normalize.
  const result = validateContact(input);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  // 6. Rate limit, keyed on the real client IP. Counts every valid, same-origin
  //    attempt that reaches here (honeypot/invalid requests returned earlier, so
  //    they never populate the limiter). Best-effort: a transient send failure
  //    still spends a slot, but the 5/10min budget leaves ample room to retry.
  if (!limiter.check(clientIp(req))) {
    return NextResponse.json(
      { ok: false, error: "Too many messages - please try again shortly." },
      { status: 429 },
    );
  }

  // 7. Config from server-only env. Missing => fail closed, never leak which.
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO_EMAIL;
  const from =
    process.env.CONTACT_FROM_EMAIL || "Contact Form <contact@matthewmaynes.com>";
  if (!apiKey || !to) {
    console.error(
      "contact: RESEND_API_KEY and/or CONTACT_TO_EMAIL are not set; cannot send.",
    );
    return NextResponse.json(
      { ok: false, error: "Sorry, sending is unavailable right now." },
      { status: 500 },
    );
  }

  // 8. Send.
  try {
    await sendViaResend(buildResendPayload({ ...result.data, to, from }), apiKey);
  } catch (err) {
    console.error("contact: Resend send failed:", err);
    return NextResponse.json(
      { ok: false, error: "Sorry, sending failed. Please try again later." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
