// Pure decision seam for whether PostHog analytics should capture (spec 0016).
// Kept in this fs-free module (like theme.ts / blog-view.ts) so `node --test` can
// unit-test the rule without a browser. Imported by the client wiring
// (posthog-browser.ts) and the server error hook (instrumentation.ts).
//
// The goal: local runs must never pollute the live dashboard. Only the deployed
// production host captures.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

/**
 * True when `hostname` is a local address (any port stripped). Covers the plain
 * loopback names plus the `.local` / `.localhost` suffixes.
 */
export function isLocalHost(hostname: string | null | undefined): boolean {
  if (!hostname) return false;
  let h = String(hostname).trim().toLowerCase();
  // Strip the port without eating an IPv6 address's own colons: bracketed forms
  // ([::1] / [::1]:port) unwrap to the address; a bare host:port (exactly one
  // colon) drops the port; a bare IPv6 (multiple colons) is left as-is.
  if (h.startsWith("[")) {
    const end = h.indexOf("]");
    h = end === -1 ? h.slice(1) : h.slice(1, end);
  } else if (h.split(":").length === 2) {
    h = h.replace(/:\d+$/, "");
  }
  return LOCAL_HOSTS.has(h) || h.endsWith(".local") || h.endsWith(".localhost");
}

/**
 * Client-side gate: capture only in a production build served from a non-local
 * host. `nodeEnv !== "production"` catches `next dev`; the host check catches a
 * local production build (smoke test, `npm start`, Playwright) that still runs on
 * localhost. The deployed client is built with NODE_ENV=production and served
 * from matthewmaynes.com, so it stays enabled.
 */
export function isClientAnalyticsEnabled({
  nodeEnv,
  hostname,
}: {
  nodeEnv: string | undefined;
  hostname: string | null | undefined;
}): boolean {
  if (nodeEnv !== "production") return false;
  if (!hostname) return false;
  return !isLocalHost(hostname);
}

/**
 * Server-side gate: an EXPLICIT deploy-only flag, not NODE_ENV or the request
 * host. NODE_ENV=production alone is set by a local production build too (the
 * root docker-compose and `npm start`), so it would leak local server exceptions
 * to the live project; the upstream `Host` behind the Caddy proxy is unreliable.
 * `POSTHOG_SERVER_CAPTURE=1` is set ONLY in the deployed container
 * (`deploy/docker/compose.site.yml`), so it is off for every local run - dev,
 * `npm start`, the smoke test, and even a local `docker compose up`. NODE_ENV is
 * kept as a belt-and-suspenders second condition.
 */
export function isServerAnalyticsEnabled({
  nodeEnv,
  captureFlag,
}: {
  nodeEnv: string | undefined;
  captureFlag: string | undefined;
}): boolean {
  return nodeEnv === "production" && captureFlag === "1";
}
