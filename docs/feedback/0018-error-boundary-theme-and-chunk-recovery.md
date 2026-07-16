# 0018 - Error page paints light + no recovery from stale-deploy chunk errors

Source: user report - "after a period of inactivity I get a 'something went wrong' page" and "the
404 page shows in light mode when the rest of the site is dark". Reproduced locally.

## Symptom

1. **Error page in light mode.** With the site set to dark, an uncaught render error painted the
   "Something went wrong" fallback in LIGHT mode. (A true 404 via `not-found.tsx` stayed dark - the
   two were conflated in the report; only the error path was broken.)
2. **Dead error page after inactivity.** A tab left open across a deploy threw a `ChunkLoadError`
   on the next client navigation (the old content-hashed chunk 404s), landing on the fallback with
   no way forward but a manual refresh.

## Root cause

- On a SERVER-rendered error, Next serves a bare `<html id="__next_error__">` document, NOT the
  root layout - so the layout's pre-paint `ThemeScript` never runs and `error.tsx` inherits no
  `.dark`. `global-error.tsx` has the same shape: it renders its own document, and its inline
  `<ThemeScript>` does not execute on a client mount (React does not run injected-script tags and
  it owns the `<html>` className). Both fell back to the default light theme.
- Chunks are renamed every deploy; a `ChunkLoadError` was treated as any other crash (show the
  fallback) instead of what it is (this tab is running a build that no longer exists).

## Fix

- `src/lib/theme.ts`: add `applyStoredTheme()` - the JS twin of the inline pre-paint script - and
  call it from the effect in both `app/error.tsx` and `app/global-error.tsx`, so a client-mounted
  or bare-shell error page re-applies the visitor's light/dark choice.
- `src/lib/chunk-recovery.ts`: `isChunkLoadError()` + `recoverFromChunkError()` - detect the
  stale-deploy signature and force ONE full reload to the fresh build, guarded by a sessionStorage
  timestamp so a chunk that is genuinely gone cannot loop. Wired into both boundaries.
- Added `app/error.tsx` (there was only `global-error.tsx`): a route-level boundary catches page
  errors without escalating to a whole-document replacement, and hosts the recovery + theme logic.
- Tests: `tests/chunk-recovery.test.ts` (signature match, one-shot reload, loop guard, window
  passed) and new `applyStoredTheme` cases in `tests/theme.test.ts`. Verified in a browser by
  throwing from a temporary dynamic route: dark choice -> dark fallback, light -> light.

## Learning

A boundary that renders its OWN document (`global-error`, and the server-error `__next_error__`
shell that hosts `error.tsx`) does not get the root layout - so anything the layout does pre-paint
(theme, fonts) must be re-applied by the boundary itself in an effect. An inline
`dangerouslySetInnerHTML` script only runs in server-rendered HTML, never on a client mount. And a
`ChunkLoadError` is not a crash to display - it is a signal to reload onto the current build.
