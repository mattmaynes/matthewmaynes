# 0012 - Local-suppression server gap (spec 0016)

Persona review of PR #53 (engineer/tester/analytics). Engineer approved; one analytics **major** plus
minors, captured here per protocol. All fixes were code/test/config/docs.

## Symptom

- **Server exceptions still leaked from a local production build (analytics, major).** Spec 0016 gated
  the *client* on `NODE_ENV === "production"` **and** a non-local hostname, but gated the *server*
  (`onRequestError`) on `NODE_ENV === "production"` alone. A local production build (`npm run build &&
  npm start`, the smoke test, Playwright) runs with `NODE_ENV=production` and ships the committed
  `phc_` key, so server exceptions from any local prod build were sent to the live US Cloud project -
  directly contradicting the spec's own Outcome ("a local production build sends nothing... no server
  exceptions").
- Minors/nits: client gate is a denylist ("not localhost") not an allowlist (analytics); un-anchored
  suffix negative test missing and `[::1]:3000` untested (tester); the seam->wiring link was only
  proven by a manual Playwright check, not in CI (tester); a dead `[::1]` set entry and an
  unnecessary dynamic import (engineer).

## Root cause

- **`NODE_ENV=production` is not a "deployed" signal.** It is set by a local production build too -
  and this repo's *local* `docker-compose.yml` sets `NODE_ENV=production` as well - so it cannot
  distinguish the deployed container from a local prod run. The client had a second, reliable signal
  (the browser's real hostname); the server had none (the proxied `Host` behind Caddy is unreliable),
  so NODE_ENV-only quietly failed the "local sends nothing" guarantee on the server side.

## Fix

- Server now gates on an **explicit deploy-only flag** `POSTHOG_SERVER_CAPTURE=1`, set only in the
  deployed stack (`deploy/docker/compose.site.yml`), in addition to `NODE_ENV === "production"`. It is
  never set locally (not in `docker-compose.yml`, `.env.example` blank), so every local run -
  including `docker compose up` - is silent server-side. Documented in `.env.example`.
- Kept the client as a denylist by design: it errs toward capturing, so `www.`/IP/future hosts are
  never wrongly dropped (losing real data is worse than a rare stray event).
- Added the anchored-suffix negative tests + `[::1]:3000`; added a smoke assertion that the client
  bundle ships the suppression gate (`127.0.0.1` literal); removed the dead set entry; made the
  instrumentation import static.

## Learning

See `overview/learnings.md` (PostHog analytics). Headline: **`NODE_ENV === "production"` is not a
"deployed" signal** - local production builds (and this repo's local compose) set it too. To mean
"only the real deployment", use an explicit deploy-only env flag set solely in the deployed stack, or
(on the client) the browser's real hostname.
