import { PostHog } from "posthog-node";
import { analytics } from "@/lib/analytics";

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
