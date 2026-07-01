# 0014 - PostHog: analytics, session replay, and error tracking

## Problem

The site ships with zero product analytics or observability. There is no way to see which pages
get traffic, how visitors move through the site, where they drop off, or whether the client or
server is throwing errors in the wild. For a personal-brand site whose job is to be found and to
convert a visit into a contact, that is a blind spot: we cannot tell what is working, and a broken
page or a failing contact submission could go unnoticed indefinitely.

This spec wires the site to **PostHog (US Cloud)** for three of the four requested surfaces -
**product analytics**, **session replay**, and **error tracking**. The fourth surface, **logs**,
uses PostHog's OpenTelemetry (OTLP) pipeline, a materially heavier integration (OTel SDK, exporter,
extra config), so it is split into its own follow-up (spec 0015) to keep this change small and 1:1
with a single PR, per the Spectra "one spec, one shippable feature" rule.

Audience (from the developer): Matthew, as the site operator, watching traffic, replays, and errors
in the PostHog dashboard.

## Outcome

When done:

- **Analytics**: every page view (including client-side App Router route changes) and page-leave is
  captured to PostHog; autocapture records clicks and interactions. The PostHog "Web analytics"
  dashboard shows real traffic within minutes of deploy.
- **Session replay**: visitor sessions are recorded and viewable in PostHog, with **all form
  inputs masked** so no contact-form text (or any typed value) is ever stored in a recording.
- **Error tracking**: unhandled **client** exceptions and unhandled **server** exceptions (route
  handlers, RSC render, including the `POST /v1/contact` endpoint) surface in PostHog Error
  tracking with stack traces. A `global-error.tsx` boundary reports React render crashes.
- **Ad-blocker resistant + future-CSP-friendly**: all PostHog network traffic is same-origin,
  proxied through `/ingest/*`, so tracker blockers and a later Content-Security-Policy do not need a
  third-party `connect-src` exception.
- **No secret leaks**: only the publishable `phc_` project key reaches the browser bundle; no
  personal API key exists anywhere in the repo or the client. No PII is added to tracked files.

## Scope

**In**

- **Dependencies**: add `posthog-js` (client) and `posthog-node` (server-side error capture). No
  OpenTelemetry packages (those belong to the logs follow-up, spec 0015).
- **Configuration** (`src/lib/site.ts` or a small `src/lib/analytics.ts` seam):
  - `NEXT_PUBLIC_POSTHOG_KEY` - the publishable project key `phc_qFWQ8Dx...` (client token, US
    Cloud). Because `NEXT_PUBLIC_*` is inlined at **build time** (not read at runtime like the
    contact secrets), it needs a **committed default** so every build (local, Docker, CI) produces
    a working bundle, overridable by the env var. This key is a publishable client token, not a
    secret - it ships in the client JS by design - so committing it does not violate the public-repo
    rule. Documented in `.env.example`.
  - `NEXT_PUBLIC_POSTHOG_HOST` defaults to `/ingest` (the same-origin proxy path); `ui_host` set to
    `https://us.posthog.com` so in-app links resolve to the real dashboard.
- **Reverse-proxy rewrites** in `next.config.ts` (`rewrites()` + `skipTrailingSlashRedirect: true`):
  - `/ingest/static/:path*` -> `https://us-assets.i.posthog.com/static/:path*`
  - `/ingest/array/:path*`  -> `https://us-assets.i.posthog.com/array/:path*`
  - `/ingest/:path*`        -> `https://us.i.posthog.com/:path*`
- **Client provider** `src/components/posthog-provider.tsx` (`"use client"`), mounted in
  `src/app/layout.tsx` wrapping `{children}`:
  - `posthog.init` with `api_host: '/ingest'`, `ui_host: 'https://us.posthog.com'`,
    `capture_pageview: false` (App Router needs manual pageviews), `capture_pageleave: true`,
    autocapture on, `capture_exceptions: true` (client exception autocapture),
    `session_recording: { maskAllInputs: true }`, and **cookieless persistence** (memory /
    localStorage, no tracking cookie) per the consent decision below.
  - A `PostHogPageView` child using `usePathname` + `useSearchParams` (wrapped in `<Suspense>`) to
    fire `$pageview` on every route change.
- **Server error capture**:
  - `src/instrumentation.ts` exporting `register()` (init `posthog-node` client) and
    `onRequestError` -> `posthog.captureException(err, ...)` so RSC/route-handler errors report.
  - `src/app/global-error.tsx` - a client error boundary that calls `posthog.captureException`
    then renders a minimal branded fallback.
- **Replay privacy hardening**: `maskAllInputs: true` plus a defensive `ph-no-capture` class on the
  contact-form field wrapper, so the message body is masked even if masking config regresses.
- **Consent model** (developer-confirmed): **no banner**; PostHog runs for all visitors in
  **cookieless** mode with all inputs masked. Documented in the code and architecture note. The
  spec records the escalation path (gate replay behind an opt-in toggle) as a future option, not
  built here.
- **Tests** (extend `tests/*.test.mjs`, node --test smoke): assert the PostHog init/provider is
  present in the served HTML/bundle; assert the `/ingest/*` rewrites are configured (a proxied
  request path resolves, not a 404); assert the exposed key is the publishable `phc_` token and
  that **no** `phx_`/personal-key pattern appears in the client bundle; assert the contact-form
  input carries the masking marker.
- **Reflect**: update `docs/overview/features.md` (new "Analytics & observability" behavior),
  `architecture.md` (PostHog integration, the `/ingest` proxy, and the build-time `NEXT_PUBLIC`
  inlining note vs runtime contact secrets), and `learnings.md` if anything bites.

**Out** (later / other specs)

- **Logs via OpenTelemetry** - spec 0015 (OTLP exporter shipping server logs to PostHog US Cloud).
- **Consent banner / cookie UI** - not built; documented as the fallback if strict EU compliance is
  ever needed.
- **User identification / `identify()`** - the site has no auth or accounts, so visitors stay
  anonymous. No `identify` calls.
- **Feature flags, experiments, surveys, custom dashboards** - other PostHog products, separate
  concerns.
- **Custom product events** beyond autocapture + pageviews (e.g. explicit "contact submitted"
  events) - can be a small follow-up once we see what the autocapture data misses.
- **A Content-Security-Policy** - still tracked separately; this spec deliberately keeps PostHog
  same-origin so that future CSP work stays simple.

## Approach

- **Proxy first, so nothing is third-party.** Routing PostHog through `/ingest` rewrites means the
  browser only ever talks to `matthewmaynes.com`; tracker blockers that block `*.posthog.com` miss
  it, and a future CSP needs no extra `connect-src`. `skipTrailingSlashRedirect: true` is required
  because PostHog's ingest paths use trailing slashes that Next would otherwise 308-redirect and
  break capture. The rewrites live in `next.config.ts` alongside the existing `headers()`.
- **Build-time key, not runtime.** Unlike the contact secrets (server-only, read at runtime, never
  committed), a `NEXT_PUBLIC_*` value is baked into the client bundle by `next build`. So the
  publishable key gets a committed default (overridable by env at build time) - otherwise the CI
  Docker build would emit a bundle with no key. This is a publishable client token by design, so it
  is safe in a public repo; the private/personal API key is never used here. This distinction is
  worth an explicit architecture note so the "config-free image, env at runtime" rule is not
  mis-applied to a `NEXT_PUBLIC` var.
- **Replay masks everything typed.** `maskAllInputs: true` is the primary guard; the `ph-no-capture`
  class on the contact field is belt-and-suspenders. The public-repo/PII rule is thereby enforced
  for recordings the same way it is for the repo: structurally, not by remembering to be careful.
- **Errors from both runtimes.** Client exceptions via posthog-js autocapture + `global-error.tsx`;
  server exceptions via `instrumentation.ts` `onRequestError` + posthog-node. One product, both
  sides, so a failing contact POST is visible.
- **Cookieless, no banner** (developer-confirmed). Session replay does not technically or (for a
  personal Ontario/PIPEDA site with all inputs masked) practically require a banner. Persistence is
  cookieless to further reduce the consent surface. The strict fallback (opt-in gate on replay) is
  documented, not implemented.
- **ASCII-only**, straight quotes, no long dashes, per Trellis (`docs/rules/guidelines.md`).
- **Build in a worktree**, test before commit, open a PR, review with the personas the diff touches,
  merge on approval. Personas: **engineer** (new client/server integration code), **tester** (new
  observable behavior + smoke assertions), **architect** (new dep, proxy layer, build-time-config
  boundary), **security** (new deps, outbound network egress, PII-in-replay, key handling), and the
  optional **analytics** persona (enable it for this review - it is the whole point of the change).

## Acceptance

- [ ] After deploy, PostHog (US Cloud) shows live pageviews within minutes; client
      route changes register as distinct `$pageview` events (not just the first load).
- [ ] Session replays appear in PostHog and are watchable; opening the contact page, typing in the
      name/email/message fields, and submitting yields a replay where **every input value is
      masked** (no typed characters visible).
- [ ] Throwing a client error and a server error each produces an entry in PostHog Error tracking
      with a usable stack trace; `global-error.tsx` renders a branded fallback on a render crash.
- [ ] All PostHog network requests in the browser go to `matthewmaynes.com/ingest/*` (same-origin);
      none go directly to `*.posthog.com`. `skipTrailingSlashRedirect` is set.
- [ ] The client bundle contains only the publishable `phc_` key; grepping the bundle finds no
      personal API key. `.env.example` documents `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST`.
- [ ] `npm run lint`, `npm run build`, and `npm test` all pass; the smoke test asserts the provider,
      the `/ingest` proxy, the publishable-only key, and the contact-input masking marker.
- [ ] No PII and no personal API key in any tracked file or in git history.
- [ ] `docs/overview/` updated (features + architecture; learnings if anything bit us).

## Notes

- **Given**: project token `phc_qFWQ8DxzsJ8KvfcASxpB88AfV9jZJq7Mp2XsunceNCYh` (publishable client
  key), region **US Cloud** (`us.i.posthog.com` / `us-assets.i.posthog.com`, dashboard
  `us.posthog.com`). The project id is not needed - ingestion authenticates with the publishable
  key alone; the id is only for the management API (personal key) and dashboard URLs.
- **Packages**: `posthog-js`, `posthog-node`. No OTel here (spec 0015 - logs).
- **Interaction with Caddy**: the `/ingest` rewrites are handled inside the Next server, upstream of
  nothing that Caddy needs to know about; the existing hostname-routing proxy is unaffected.
- **Interaction with the 512MB host**: posthog-js is client-side (no server RAM); posthog-node is a
  light client used only in the error path. Negligible footprint.
- **Escalation path (not built)**: for strict EU-style compliance, gate `posthog.startSessionRecording`
  behind an explicit opt-in and default replay off until consent, leaving analytics running.
