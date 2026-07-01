# 0016 - Suppress analytics when running locally

## Problem

PostHog (spec 0014) initializes and captures for any visitor as soon as the app runs. That includes
**local runs** - `npm run dev`, and a local production build (`npm run build && npm start`, the smoke
test, a Playwright check). So every local page load, session replay, and thrown error is sent to the
live US Cloud project and pollutes the real metrics dashboard with developer traffic: inflated
pageviews, junk replays of localhost, and dev-only exceptions mixed in with production errors.

Audience (from the developer): Matthew, developing locally, who wants the dashboard to reflect only
real visitors to `matthewmaynes.com`.

## Outcome

When done:

- Running the site locally - `next dev`, or a local production build on `localhost`/`127.0.0.1` -
  sends **nothing** to PostHog: no init, no pageviews, no session replay, no autocapture, no client
  or server exceptions. Verified by loading a local page and observing **zero** `/ingest` requests.
- The **deployed** site on `matthewmaynes.com` is unchanged: analytics, replay, and error tracking
  all still work exactly as spec 0014 shipped them.
- The gate is a small, **unit-tested pure function**, so the rule ("only the production host
  captures") is provable without a browser.

## Scope

**In**

- **A pure decision seam** `src/lib/analytics-env.js` (JS, node-testable like `theme.js`/`blog.js`):
  - `isLocalHost(hostname)` - true for `localhost`, `127.0.0.1`, `0.0.0.0`, `::1`, and `*.local` /
    `*.localhost` (port stripped).
  - `isClientAnalyticsEnabled({ nodeEnv, hostname })` - true only when `nodeEnv === "production"`
    **and** the hostname is not local. Covers both `next dev` (dev NODE_ENV) and a local prod build
    (localhost host).
  - `isServerAnalyticsEnabled({ nodeEnv, captureFlag })` - true only when `nodeEnv === "production"`
    **and** an explicit deploy-only flag `POSTHOG_SERVER_CAPTURE === "1"`. NODE_ENV alone is not
    enough: both the deployed and the local `docker-compose.yml` run `NODE_ENV=production`, so a
    local production build would otherwise leak server exceptions. The flag is set only in the
    deployed stack (`deploy/docker/compose.site.yml`); the proxied `Host` is unreliable, so it is
    not used. (This closes a hole caught in the PR #53 review.)
- **Client wiring** (`src/lib/posthog-browser.ts`): a `clientAnalyticsEnabled()` wrapper feeding
  `process.env.NODE_ENV` + `window.location.hostname` into the seam. `initPostHogBrowser()` returns
  early (no `posthog.init`) when disabled, and the capture sites are guarded so nothing is sent and
  no "you must init PostHog" console warnings fire locally:
  - `posthog-pageview.tsx` - skip the `$pageview` capture when disabled.
  - `contact-form.tsx` - skip the `contact_form_*` events when disabled.
  - `global-error.tsx` - skip `captureException` when disabled.
- **Server wiring** (`src/instrumentation.ts`): `onRequestError` returns early unless
  `isServerAnalyticsEnabled({ nodeEnv, captureFlag })` (so `next dev`, `npm start`, the smoke test,
  and a local `docker compose up` never report). The deploy sets `POSTHOG_SERVER_CAPTURE=1` in
  `deploy/docker/compose.site.yml`; `.env.example` documents it (blank locally).
- **Tests**: `tests/analytics.test.mjs` unit-tests the three seam functions (localhost variants, the
  enabled/disabled matrix over nodeEnv x hostname).
- **Reflect**: note the production-host gate in `docs/overview/architecture.md` and `features.md`.

**Out**

- Any consent/opt-out UI (unchanged; still no banner, cookieless).
- A separate PostHog "dev" project for local traffic (we suppress rather than reroute).
- Changing what is captured in production, or the `/ingest` proxy, key handling, or masking.
- Logs (OTLP) - still a later spec.

## Approach

- **Gate on the production host, not just NODE_ENV.** NODE_ENV alone would still let a local
  production build (`npm start`, smoke, Playwright) send to the live project. Adding the
  `isLocalHost(window.location.hostname)` check on the client closes that, so *any* local run is
  silent. The deployed client runs with `NODE_ENV === "production"` (baked at build) on
  `matthewmaynes.com`, so it stays enabled.
- **Don't init at all when disabled** rather than init-then-opt-out: no SDK load, no replay, no
  network - the cleanest guarantee of "nothing sent", and the capture-site guards keep the console
  quiet.
- **Server uses an explicit deploy-only flag.** The browser knows its real address; the server
  behind Caddy does not (the proxied `Host` may be an internal name/IP), and NODE_ENV=production is
  also set by a local production build - so neither reliably tells "deployed" from "local prod".
  A flag set only in the deployed compose does, without a false silence of real errors.
- **Pure seam, unit-tested** - the same pattern as `theme.js`: the branching logic lives in plain JS
  and is asserted by `node --test`, so the rule is provable without booting a browser. A Playwright
  smoke (localhost -> zero `/ingest`) confirms the wiring end to end.
- Build in a worktree, test before commit, PR, review with the touched personas (engineer, tester,
  analytics), merge on approval.

## Acceptance

- [ ] `next dev` and a local prod build on `localhost` issue **zero** `/ingest` requests (no init,
      pageview, replay, or exception) - confirmed in a browser.
- [ ] The seam functions are unit-tested: `isLocalHost` for each local form (incl. IPv6/ports) + a
      real host and non-anchored lookalikes; `isClientAnalyticsEnabled` true for a production
      non-local host and false for dev or any localhost; `isServerAnalyticsEnabled` true only for
      `{production, flag set}` and false for a local production build (no flag).
- [ ] No console "must initialize PostHog" warnings during local runs.
- [ ] Production behaviour is unchanged (the deployed client, `NODE_ENV=production` on the real host,
      still initializes and captures; server error tracking still reports in production).
- [ ] `npm run lint` / `build` / `test` pass; overview docs updated.
