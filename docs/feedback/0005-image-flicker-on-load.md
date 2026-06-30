# 0005 - Images flicker / pop in on load (home + about)

## Symptom

On the home and about pages (and other image-bearing pages), images flash blank
and then "pop" in as they decode. The effect reads as a flicker on first paint
and, on the about page, again as photos lazy-load on scroll.

## Root cause

Two gaps, neither of them a missing `next/image` (every image already uses it):

1. **No `placeholder`.** No image set `placeholder="blur"`/`blurDataURL`, so each
   one renders as empty reserved space and then appears all at once after decode -
   the pop. The about page is worse: its four images also lacked `priority`, so
   they lazy-load and flash in on scroll.
2. **Heavy PNG sources, default formats.** Originals are large PNGs (hero
   `area-i-live.png` ~1 MB / 1800x1350). `next.config.ts` had no `images` block,
   so optimization defaulted to WebP only (no AVIF), leaving the first decode
   slower than it needs to be.

## Fix

- Static-import the six images in `src/lib/site.ts` so Next generates a
  build-time `blurDataURL` for each (the cleanest path - no hand-maintained blur
  data). `SiteImage` becomes `StaticImageData & { alt }`; real width/height now
  come from the import, not hand-captured numbers.
- Pass the static object as `src` and add `placeholder="blur"` on every `<Image>`
  across all four image-bearing pages: `page.tsx` (home), `about/page.tsx`,
  `projects/page.tsx`, and `resume/page.tsx`.
- Add `priority` to each above-the-fold image (the home hero + every headshot,
  the projects banner) so they are not lazy-loaded.
- Add `images.formats = ["image/avif", "image/webp"]` to `next.config.ts`.
- Lock it in: `tests/smoke.test.mjs` now asserts those four routes inline a
  `data:image/...;base64,` blur placeholder, and finds the standalone `server.js`
  even when the two-lockfile worktree quirk nests it.

## Learning

`next/image` alone does not prevent flicker - it reserves space and optimizes
bytes, but an image with no `placeholder` still pops in after decode. For
locally-bundled images, **static-import them** so `placeholder="blur"` gets an
auto-generated `blurDataURL` for free; reserve `priority` for above-the-fold
images so they are not lazy-loaded. Prefer carrying images as static imports in
the shared metadata map rather than string paths.
