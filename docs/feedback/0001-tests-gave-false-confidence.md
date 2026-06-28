# 0001 - Scaffold tests gave false confidence

Source: persona review of PR #1 (tester major x2, engineer minor). Spec 0001.

## Symptom

The only tests were the route smoke tests, and they asserted strings like "About", "Resume",
"Blog", and "Matthew Maynes" - all of which appear on every page through the shared header/footer.
So 6 of 7 route checks passed on the shared layout alone: a route rendering a blank or wrong body
would still go green. Separately, the theme behavior (system default + persisted override +
no-flash pre-paint) - a named acceptance criterion - had no tests at all.

## Root cause

- Smoke assertions targeted text that is not route-unique (layout chrome), so they validated the
  shell, not the page.
- The theme logic lived inline in a `.tsx` string (`theme-script.tsx`) and in a client component,
  with no seam to unit-test, so it was left uncovered.

## Fix

- Smoke test now asserts the route-unique `<title>` plus the presence of an `<h1>`, so it proves
  the correct page body rendered (`tests/smoke.test.mjs`).
- Extracted the resolution rule and the inline script source into `src/lib/theme.js`
  (`resolveDark` + `themeScriptSource`). Added `tests/theme.test.mjs` which tests the pure rule
  AND runs the real inline script against mocked browser globals, asserting both agree.

## Learning

When a test asserts text, assert something the unit under test uniquely produces - not chrome that
every page shares - or it will pass on the layout alone. And every behavior named as acceptance
criteria needs a test; if logic is trapped in JSX/strings, give it a plain-module seam so it can be
covered. Rolled into `overview/learnings.md`.
