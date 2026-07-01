/**
 * PostHog configuration (spec 0014). One source of truth for both the client
 * (posthog-js) and the server (posthog-node) integrations.
 *
 * The key is the PostHog *publishable* project key (the `phc_` client token). It
 * ships in the browser bundle by design, so it is NOT a secret and committing a
 * default here does not violate the public-repo rule. Unlike the contact secrets
 * (server-only, read at runtime), a `NEXT_PUBLIC_*` value is inlined by
 * `next build` at BUILD time - so it needs a committed default, otherwise the CI
 * Docker build would emit a bundle with no key. The env var still overrides it at
 * build time if a different project is ever targeted.
 *
 * No personal/management API key lives here or anywhere in the repo: ingestion
 * authenticates with the publishable key alone.
 */

// US Cloud region hosts. Exported so the `/ingest` reverse-proxy rewrites in
// next.config.ts import them from here too - one source of truth, so a region
// change is a single edit. The browser talks to the same-origin `/ingest` proxy
// (tracker blockers and a future CSP need no third-party exception); the server
// posts directly to the ingest host (server egress is not ad-blocked and cannot
// use the browser-origin proxy path).
export const POSTHOG_INGEST_HOST = "https://us.i.posthog.com";
export const POSTHOG_ASSET_HOST = "https://us-assets.i.posthog.com";
export const POSTHOG_UI_HOST = "https://us.posthog.com";

const PUBLISHABLE_KEY_DEFAULT = "phc_qFWQ8DxzsJ8KvfcASxpB88AfV9jZJq7Mp2XsunceNCYh";

export const analytics = {
  /** Publishable client key (phc_). Safe in the browser bundle. */
  key: process.env.NEXT_PUBLIC_POSTHOG_KEY || PUBLISHABLE_KEY_DEFAULT,
  /** Client ingest host: the same-origin proxy path by default. */
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "/ingest",
  /** Where in-app PostHog links (e.g. toolbar) should point. */
  uiHost: POSTHOG_UI_HOST,
  /** Direct US Cloud ingest host for server-side capture (no proxy). */
  serverHost: POSTHOG_INGEST_HOST,
} as const;
