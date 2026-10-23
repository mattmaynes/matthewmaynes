import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import {
  CAPTCHA_SCOPE_CONTACT,
  createNonceStore,
  verifyCaptchaToken,
} from "@/lib/captcha";
import { clientIp, createRateLimiter, isSameOrigin } from "@/lib/http-guards";
import { captureServerEvent } from "@/lib/posthog-server";
import {
  buildResendPayload,
  renderContactNotification,
  sendViaResend,
  validateContact,
} from "@/lib/contact";
import {
  createTokenCache,
  recordWebsiteContact,
  submitSubscription,
} from "@/lib/subscribe";

/**
 * `POST /v1/contact` - relays a contact-form submission to the site owner by email
 * (an on-brand HTML notification via Resend) without ever exposing the destination
 * address to the client, and records the sender in Constant Contact (spec 0032):
 * always as an `unsubscribed` contact on the Website Contact list, and - if the
 * opt-in box was ticked - also subscribed to the blog list. The `/v1/` prefix
 * versions the contract. A submission must carry a single-use captcha token
 * (spec 0043) before any of that happens. The pure logic lives in the unit-tested
 * `@/lib/contact`, `@/lib/subscribe` and `@/lib/captcha`; this handler bridges the
 * HTTP request, reads server-only secrets, and maps outcomes to status codes.
 * Other methods 405 automatically.
 */

// Best-effort per-IP limiter, module-scoped so it persists across requests in
// the one long-lived server process: 5 sends / 10 min per IP (spec 0008).
const limiter = createRateLimiter({ max: 5, windowMs: 10 * 60 * 1000 });

// Module-scoped access-token cache: mint a 24h Constant Contact token once and
// reuse it across requests until shortly before expiry (spec 0018), shared by the
// record + subscribe paths below. A deploy/restart just re-mints.
const ctctTokenCache = createTokenCache();

// Module-scoped replay guard for the captcha token (spec 0043), so a token that
// has already sent a message cannot send a second one. Persists for the life of
// the process; a restart re-arms it (see `createNonceStore`).
const captchaNonceStore = createNonceStore();

// The on-brand HTML notification body, read once at module load. It lives in
// `emails/templates/` (single source of truth, previewable); `next.config.ts`
// `outputFileTracingIncludes` copies it into the standalone/Docker runtime. A read
// failure falls back to a minimal body so a submission is never lost to a missing
// asset.
const NOTIFICATION_TEMPLATE = loadNotificationTemplate();

function loadNotificationTemplate(): string {
  try {
    return readFileSync(
      join(process.cwd(), "emails/templates/contact-notification.html"),
      "utf8",
    );
  } catch (err) {
    console.error(
      "contact: could not read contact-notification.html; using plain fallback:",
      err,
    );
    return "<p>[[NAME]] &lt;[[EMAIL]]&gt; wrote on [[DATE]]:</p><p>[[MESSAGE]]</p>";
  }
}

// Reject bodies larger than this before parsing (message cap is 5000 chars; this
// leaves generous headroom for UTF-8 + the other fields yet bounds the parse).
const MAX_BODY_BYTES = 32 * 1024;

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

  // 4. Validate + normalize.
  const result = validateContact(input);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  // 5. Captcha (spec 0043). Deliberately AFTER validation, so a malformed body
  //    still fails fast and cheaply and a hard-won token is never spent on a
  //    request that was going to 400 anyway - and before the rate limit, since a
  //    tokenless scripted POST should not consume a real visitor's budget.
  //
  //    Only an explicit `rejected` verdict may 400. `errored` means the captcha
  //    machinery is broken (no secret, a library fault), and a broken captcha
  //    must not turn into every visitor seeing success while no message is ever
  //    sent - the invisible failure feedback 0028 exists to prevent. So it fails
  //    OPEN: the submission proceeds, the fault is logged at error level, and it
  //    gets its own PostHog event rather than blending into the rejection counts.
  const captcha = verifyCaptchaToken(
    process.env.CAP_SECRET,
    input.captchaToken,
    { scope: CAPTCHA_SCOPE_CONTACT, store: captchaNonceStore },
  );
  if (captcha.status === "rejected") {
    // Reason and source form only - never the email address. Subscriber
    // addresses stay out of logs and analytics by design (see @/lib/subscribe).
    captureServerEvent("captcha_rejected", {
      reason: captcha.reason,
      form: CAPTCHA_SCOPE_CONTACT,
    });
    return NextResponse.json(
      {
        ok: false,
        error: "Please complete the human check and try again.",
      },
      { status: 400 },
    );
  }
  if (captcha.status === "errored") {
    console.error(
      "contact: captcha verification is unavailable, letting the submission through:",
      captcha.error,
    );
    captureServerEvent("captcha_unavailable", {
      reason: "verify_failed",
      form: CAPTCHA_SCOPE_CONTACT,
    });
  }

  // 6. Rate limit, keyed on the real client IP. Counts every valid, same-origin
  //    attempt that reaches here (invalid requests returned earlier, so they never
  //    populate the limiter). Best-effort: a transient send failure still spends a
  //    slot, but the 5/10min budget leaves ample room to retry.
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

  // 8. Send the notification (primary action). Render the on-brand HTML body with
  //    the (escaped) form data, then hand it to Resend. A failure here 500s, since
  //    the visitor's message would otherwise be lost.
  const date = new Date().toLocaleString("en-CA", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Toronto",
  });
  const html = renderContactNotification(NOTIFICATION_TEMPLATE, {
    ...result.data,
    date,
  });
  try {
    await sendViaResend(
      buildResendPayload({ ...result.data, to, from, html }),
      apiKey,
    );
  } catch (err) {
    console.error("contact: Resend send failed:", err);
    return NextResponse.json(
      { ok: false, error: "Sorry, sending failed. Please try again later." },
      { status: 500 },
    );
  }

  // 9. Record the sender in Constant Contact (spec 0032). BEST-EFFORT: the message
  //    already went out, so any CTCT failure is logged and swallowed rather than
  //    failing the request. Skipped cleanly when the CTCT env is unset.
  //      - opt-in ticked -> subscribe (sign_up_form) to the blog + Website Contact
  //        lists, recording consent.
  //      - otherwise      -> create an `unsubscribed` contact on the Website Contact
  //        list (a CRM record without implied consent).
  const clientId = process.env.CTCT_CLIENT_ID;
  const refreshToken = process.env.CTCT_REFRESH_TOKEN;
  const blogListId = process.env.CTCT_LIST_ID;
  const websiteListId = process.env.CTCT_WEBSITE_LIST_ID;
  const wantsSubscribe = input.subscribe === true;
  if (clientId && refreshToken) {
    try {
      const creds = {
        email: result.data.email,
        name: result.data.name,
        clientId,
        refreshToken,
      };
      if (wantsSubscribe && blogListId) {
        await submitSubscription(
          {
            ...creds,
            listIds: websiteListId ? [blogListId, websiteListId] : [blogListId],
          },
          { cache: ctctTokenCache },
        );
      } else if (websiteListId) {
        await recordWebsiteContact(
          { ...creds, listIds: [websiteListId] },
          { cache: ctctTokenCache },
        );
      }
    } catch (err) {
      console.error(
        "contact: Constant Contact record/subscribe failed (non-fatal):",
        err,
      );
    }
  }

  return NextResponse.json({ ok: true });
}
