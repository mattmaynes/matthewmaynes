# 0016 - Suppress analytics locally - build plan

Source: `docs/specs/0016-analytics-local-suppression.md`.

## Steps

1. **Pure seam** `src/lib/analytics-env.js` - `isLocalHost`, `isClientAnalyticsEnabled({nodeEnv,
   hostname})`, `isServerAnalyticsEnabled(nodeEnv)`. Done.
2. **Client gate** `src/lib/posthog-browser.ts` - `clientAnalyticsEnabled()` feeds NODE_ENV +
   `window.location.hostname` into the seam; `initPostHogBrowser()` no-ops when disabled.
3. **Guard capture sites** - `posthog-pageview.tsx`, `contact-form.tsx` (via a `track()` helper),
   `global-error.tsx` all skip capture when disabled (no send, no console warning).
4. **Server gate** `src/instrumentation.ts` - `onRequestError` returns early unless
   `isServerAnalyticsEnabled(process.env.NODE_ENV)`.
5. **Unit test** `tests/analytics.test.mjs` - the three seam functions.
6. **Docs** - `architecture.md` + `features.md` note the production-host gate.
7. **Verify** - `lint`/`build`/`test`; Playwright: localhost -> zero `/ingest` requests.

## Verification

- Unit + smoke suites green.
- Browser: load the built site on `127.0.0.1`, assert no `/ingest` network requests at all.
