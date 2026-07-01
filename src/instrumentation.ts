/**
 * Server-side error tracking (spec 0014). Next calls `onRequestError` for any
 * uncaught error in a Server Component render, route handler, or middleware -
 * including the `POST /v1/contact` endpoint - so a server failure surfaces in
 * PostHog Error tracking with a stack trace.
 *
 * Guarded to the Node.js runtime: posthog-node is a Node client, and this app is
 * a standalone Node server, so there is nothing to capture on the edge runtime.
 * `captureExceptionImmediate` flushes before returning, so an error is not lost.
 */
export function register() {
  // No global setup needed; the posthog-node client is created lazily on first
  // error via getPostHogServer().
}

export async function onRequestError(error: unknown) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { getPostHogServer } = await import("@/lib/posthog-server");
  const posthog = getPostHogServer();
  await posthog.captureExceptionImmediate(error);
}
