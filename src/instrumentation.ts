import { isServerAnalyticsEnabled } from "@/lib/analytics-env";

/**
 * Server-side error tracking (spec 0014). Next calls `onRequestError` for any
 * uncaught error in a Server Component render, route handler, or middleware -
 * including the `POST /v1/contact` endpoint - so a server failure surfaces in
 * PostHog Error tracking with a stack trace.
 *
 * Guarded to the Node.js runtime: posthog-node is a Node client, and this app is
 * a standalone Node server, so there is nothing to capture on the edge runtime.
 * `captureExceptionImmediate` flushes before returning, so an error is not lost.
 * Also gated on NODE_ENV so local runs (`next dev`) never report (spec 0016); we
 * use NODE_ENV rather than the request host because the upstream Host behind the
 * Caddy proxy is unreliable and could wrongly silence production error tracking.
 */
export function register() {
  // No global setup needed; the posthog-node client is created lazily on first
  // error via getPostHogServer().
}

export async function onRequestError(error: unknown) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (
    !isServerAnalyticsEnabled({
      nodeEnv: process.env.NODE_ENV,
      captureFlag: process.env.POSTHOG_SERVER_CAPTURE,
    })
  ) {
    return;
  }
  // The error hook must never throw (a slow/unreachable ingest would otherwise
  // reject out of it as an unhandled rejection), so swallow any capture failure.
  try {
    const { getPostHogServer } = await import("@/lib/posthog-server");
    await getPostHogServer().captureExceptionImmediate(error);
  } catch {
    // best-effort: reporting the error must not itself break the request path
  }
}
