# 0006 - Images slow to appear (blur placeholder lingers) on the deployed site

## Symptom

After 0005 fixed the flicker, the blur placeholder now lingers for a long time
before the real image appears - most visibly on the home hero and about page, on
the deployed (containerized) site.

## Root cause

`next/image` optimizes on demand: the first request for a given image+width
encodes it on the fly (then caches). Two things made that slow:

1. **Oversized PNG sources (the main cause).** The hero was 1800x1350 / ~973 KB
   and several photos were ~0.5-0.9 MB lossless PNG. Decoding those big PNGs
   before re-encoding is the bulk of the work, and it is paid by the first
   visitor after every deploy (the optimizer cache is cold on a fresh container),
   on top of a one-time `sharp` initialization.
2. **AVIF as the preferred format (a minor factor).** 0005 set
   `formats: ["image/avif", "image/webp"]`. AVIF files are ~35% smaller but encode
   modestly slower. An early, confounded measurement (the AVIF request was first
   and so also paid the one-time sharp init) overstated this as "~10x"; a clean
   apples-to-apples run showed only ~0.05-0.12s/image, AVIF a touch above WebP.

`sharp` is correctly bundled in the standalone runtime - this was not a slow-path
fallback.

## Fix

1. **Right-size the sources.** Convert the five photos from lossless PNG to
   quality-86 JPEG (correct format for photographs) and cap the hero at 1600px
   longest side. `eagle-snap` is a flat banner graphic, so it stays PNG (smaller
   than JPEG for that). Total source weight 3.3 MB -> 2.3 MB; the per-image encode
   input shrinks, cutting first-paint latency. No code beyond the import paths in
   `src/lib/site.ts` changes, because the static-import refactor (0005) derives
   width/height from the files themselves.
2. **WebP-only + long cache TTL.** `formats: ["image/webp"]` for the snappiest
   first paint at a negligible size cost; `minimumCacheTTL` set to a year since the
   sources are content-hashed and immutable, so each variant encodes once.

## Learning

- **Measure the optimizer honestly: the first image request to a fresh server
  also pays one-time `sharp` init**, so comparing "format A first vs format B
  second" attributes that init to A and exaggerates the gap. Warm the process with
  a throwaway request, send a real browser `Accept` header (without it Next serves
  the unoptimized source and you measure nothing), then time distinct images.
- **For on-demand image optimization, source size dominates.** Right-sizing and
  using the correct source format (JPEG for photos, PNG for flat graphics) cuts
  far more first-paint latency than the AVIF-vs-WebP choice. Reach for source
  fixes before format tuning. Follows on from feedback 0005 (the flicker fix that
  introduced the AVIF setting).
