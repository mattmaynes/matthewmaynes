# 0014 - PostHog analytics/replay/errors - build plan

Source: `docs/specs/0014-posthog-analytics.md`. Logs (OTLP) is out - spec 0015.

## Steps

1. **Deps** - `posthog-js` (^1.396) + `posthog-node` (^5.39). Done.
2. **Config seam** `src/lib/analytics.ts` - publishable key (env `NEXT_PUBLIC_POSTHOG_KEY` with a
   committed default), `host` (env `NEXT_PUBLIC_POSTHOG_HOST`, default `/ingest`), `uiHost`, and the
   direct US ingest host for server-side. Pure module, importable from client and server.
3. **Proxy** `next.config.ts` - add `rewrites()` (`/ingest/static|array` -> `us-assets`,
   `/ingest/*` -> `us.i`) and `skipTrailingSlashRedirect: true`. Keep existing `images`/`headers`.
4. **Client** `src/components/posthog-provider.tsx` (`"use client"`) - `posthog.init` (api_host
   `/ingest`, ui_host, `capture_pageview:false`, `capture_pageleave:true`, `capture_exceptions:true`,
   `persistence:'localStorage'` = cookieless, `session_recording.maskAllInputs:true`), wraps
   children in `PHProvider`; `src/components/posthog-pageview.tsx` fires `$pageview` on route change
   (Suspense around `useSearchParams`). Mount provider in `src/app/layout.tsx`.
5. **Server errors** `src/lib/posthog-server.ts` (singleton `posthog-node` -> `us.i.posthog.com`) +
   `src/instrumentation.ts` (`register` no-op; `onRequestError` -> `captureException`, node runtime
   only). `src/app/global-error.tsx` - client boundary reports then renders a branded fallback.
6. **Replay privacy** - `maskAllInputs:true` + `ph-no-capture` on the contact-form control wrappers.
7. **Env docs** `.env.example` - `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (public key,
   inlined at build).
8. **Tests** `tests/smoke.test.mjs` - assert provider init present; `/ingest` proxy configured;
   only the `phc_` publishable key in HTML (no personal key); contact input masked.
9. **Verify** - `npm run lint`, `npm run build`, `npm test` green.
10. **Reflect** - `docs/overview/features.md`, `architecture.md`, `learnings.md`.

## Verification

- Smoke suite green (new + existing).
- Manual: `og`/routes unaffected; `/ingest/decide` style path proxied (not 404).
- Grep the built client chunks for the publishable key present and no `phx_`/personal key.
