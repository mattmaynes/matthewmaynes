# 0011 - PostHog review findings (spec 0014)

Persona review of PR #47 (engineer/tester/architect/security/analytics/designer). Security passed;
the others raised three majors and a set of minors, captured here per protocol. All fixes were
code/test/docs.

## Symptom

- **Landing pageview dropped every session (engineer + analytics, major).** `posthog.init()` ran in
  the provider's `useEffect`; React flushes child effects before parent effects, so the child
  `<PostHogPageView>` effect called `posthog.capture("$pageview")` *before* init. posthog-js
  early-returns from `capture()` when not loaded and does not buffer, so the first (landing)
  pageview was silently lost - a severe undercount, and single-page bounce visits recorded nothing.
- **Core conversion untracked (analytics, major).** `ph-no-capture` on the whole contact `<form>`
  (added for replay privacy) also blocks autocapture of the submit, and the spec deferred explicit
  events - so the site's one conversion emitted no event at all: no funnel, no drop-off.
- **global-error used non-existent/wrong design tokens (designer, major x2).** `text-on-primary`
  does not exist (the token is `--color-primary-foreground`) and `text-muted` is a surface fill, not
  a text colour (the text token is `text-text-muted`), so the fallback page's body text and its only
  CTA were effectively unreadable in the shipped light palette.
- Minors: the spec-mandated `/ingest` proxy assertion and a direct `maskAllInputs` assertion were
  missing from the smoke test, and the `phx_` guard scanned only the home page's chunks; PostHog
  region hosts were duplicated across `next.config.ts` and `analytics.ts`; `onRequestError` awaited
  the capture with no try/catch; `global-error` omitted `<ThemeScript>` so the fallback ignored the
  visitor's theme; and its `<h1>` used a one-off type instead of the `text-h1` token.

## Root cause

- **Effect-ordering assumption.** Initializing a shared singleton in a parent effect and consuming
  it in a child effect is backwards for React's child-first passive-effect flush. Anything a child
  effect needs on first paint must exist before render, i.e. at module scope, not in a parent effect.
- **A blanket privacy mask has an analytics cost.** `ph-no-capture` over a whole form is the right
  privacy call, but it removes the element from autocapture too, so any conversion on that form must
  be tracked explicitly - masking and measuring are separate decisions on the same element.
- **Token names were assumed, not verified** against `theme-harbor.css`/Roots.

## Fix

- Moved init to a module-scope, idempotent `initPostHogBrowser()` (`src/lib/posthog-browser.ts`),
  called at import time by the provider and reused by `global-error`, so the SDK is loaded before any
  effect fires. Verified in a real browser: the landing `$pageview` and each soft-nav route change
  now POST to `/ingest` (200).
- Added explicit **PII-free** conversion events from `handleSubmit`
  (`contact_form_submitted`/`_succeeded`/`_failed` with only an outcome reason, never field values),
  keeping `ph-no-capture` so the form stays out of replay.
- Corrected the tokens (`text-primary-foreground`, `text-text-muted`, `text-h1 font-bold`) and added
  `<ThemeScript>` to the boundary.
- Hoisted the region hosts into `analytics.ts` and imported them into the rewrites; wrapped
  `onRequestError` in try/catch; added smoke assertions for the `/ingest` rewrites (via the built
  routes-manifest, network-free), `maskAllInputs`, the conversion event, and a disk-wide `phx_` scan
  across every `.next/static` asset.

## Learning

See `overview/learnings.md` (PostHog analytics). Headline: **initialize a shared client at module
scope, not in a parent effect** (child effects run first), and **masking an element for replay
also removes it from autocapture** - track conversions on masked elements with explicit, PII-free
events.
