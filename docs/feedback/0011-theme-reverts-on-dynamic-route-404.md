# 0011 - Dark theme reverts to light on a dynamic-route 404

Source: user bug report. Verified in a real browser (Playwright) against prod and a local
production build.

## Symptom

With dark theme selected, landing on a 404 painted in light mode and "forgot" the choice - but
only for some 404s. A top-level unmatched URL (e.g. `/definitely-not-a-real-page`) kept dark; a
`notFound()` from a dynamic route (`/blog/<bad-slug>`) reverted to light. `localStorage.theme`
was still `"dark"` throughout, and the pre-paint `ThemeScript` was present in the served HTML.

## Root cause

The pre-paint script adds `.dark` to `<html>` before paint, and `<html suppressHydrationWarning>`
lets that extra class survive the initial hydration. But a `notFound()` thrown from a dynamic
route renders the not-found boundary through a **client re-render of the persistent root layout**.
That re-render reconciles `<html>`'s `className` back to its JSX value (`"h-full antialiased"`),
stripping the script-added `.dark`. `suppressHydrationWarning` only covers the first hydration
pass, not this later re-render. Statically prerendered 404s never hit that re-render, which is why
the top-level 404 was fine.

This is the same failure mode already handled for `error.tsx` and `global-error.tsx` (they call
`applyStoredTheme()` in an effect). `not-found.tsx` was the one boundary that never got it.

## Fix

- New `src/components/theme-reapply.tsx`: a tiny client component that calls `applyStoredTheme()`
  in a mount effect and renders nothing.
- `not-found.tsx` renders `<ThemeReapply />`, re-affirming the visitor's choice after the boundary
  settles. One root not-found boundary covers every dynamic route (`/blog/[slug]`,
  `/projects/[slug]`, drafts, tags).

The resolution rule (`applyStoredTheme`) was already unit-tested in `tests/theme.test.ts`; the fix
reuses it. Verified end-to-end in a browser: `/blog/<bad-slug>` now keeps dark when dark is chosen
and stays light when light is chosen.
