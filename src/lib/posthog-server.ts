import { PostHog } from "posthog-node";
import { analytics } from "@/lib/analytics";
import { isServerAnalyticsEnabled } from "@/lib/analytics-env";

/**
 * Server-side PostHog client (spec 0014) for capturing server exceptions from
 * `instrumentation.ts`. A module-level singleton so the long-running standalone
 * Node server reuses one client. It posts directly to US Cloud (server egress is
 * not ad-blocked and cannot use the browser-origin `/ingest` proxy).
 *
 * `flushAt: 1` / `flushInterval: 0` send each event immediately rather than
 * batching, so an error is not lost if the process is about to crash.
 */
let client: PostHog | undefined;

export function getPostHogServer(): PostHog {
  if (!client) {
    client = new PostHog(analytics.key, {
      host: analytics.serverHost,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

// Backend events have no person behind them, so they share one synthetic
// distinct id rather than inventing an identifier per request - which would both
// explode the person count and risk becoming a fingerprint.
const SERVER_DISTINCT_ID = "server";

/**
 * Capture a named server-side event (spec 0043 uses it for the captcha signals).
 * Gated on the same deploy-only flag as server error tracking, so local runs and
 * the smoke test never reach the live project (spec 0016). Best-effort: capture
 * runs on a request's happy path, so a slow or unreachable ingest must never turn
 * into a failed submission.
 *
 * Properties are the caller's responsibility to keep PII-free - nothing here
 * inspects them, and the contact route deliberately sends a reason and a form
 * name and no email address.
 */
export function captureServerEvent(
  event: string,
  properties: Record<string, unknown> = {},
): void {
  if (
    !isServerAnalyticsEnabled({
      nodeEnv: process.env.NODE_ENV,
      captureFlag: process.env.POSTHOG_SERVER_CAPTURE,
    })
  ) {
    return;
  }
  try {
    getPostHogServer().capture({
      distinctId: SERVER_DISTINCT_ID,
      event,
      properties,
    });
  } catch {
    // best-effort: reporting a signal must not break the request path
  }
}
