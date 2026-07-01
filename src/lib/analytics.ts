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

// US Cloud. The browser talks to the same-origin `/ingest` proxy (see the
// rewrites in next.config.ts) so tracker blockers and a future CSP need no
// third-party exception. The server posts directly - server egress is not
// ad-blocked and cannot use the browser-origin proxy path.
const PUBLISHABLE_KEY_DEFAULT = "phc_qFWQ8DxzsJ8KvfcASxpB88AfV9jZJq7Mp2XsunceNCYh";

export const analytics = {
  /** Publishable client key (phc_). Safe in the browser bundle. */
  key: process.env.NEXT_PUBLIC_POSTHOG_KEY || PUBLISHABLE_KEY_DEFAULT,
  /** Client ingest host: the same-origin proxy path by default. */
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "/ingest",
  /** Where in-app PostHog links (e.g. toolbar) should point. */
  uiHost: "https://us.posthog.com",
  /** Direct US Cloud ingest host for server-side capture (no proxy). */
  serverHost: "https://us.i.posthog.com",
} as const;
