# 0006 - Pre-warm the next/image optimizer cache after deploy

## Problem

`next/image` optimizes on demand: the first request for a given image+width
encodes it on the fly, then caches it on disk (`X-Nextjs-Cache: MISS` -> `HIT`).
On a fresh container the optimizer cache is empty, so the **first visitor after
every deploy** waits while each image encodes (the blur placeholder lingers).
Feedback 0006 cut the per-image cost (right-sized JPEG sources, WebP), but the
cold-cache first hit remains. On a low-traffic personal site that first visitor
is often the owner.

(Browser caching is already optimal and out of scope: optimized images return
`Cache-Control: public, max-age=315360000, immutable` because the sources are
content-hashed, so repeat visits never re-fetch.)

## Outcome

After a deploy completes and the container is healthy, every image variant the
site renders has already been encoded and cached, so the first real visitor gets
`X-Nextjs-Cache: HIT` with no encode wait.

## Scope

In:
- A repo script that crawls the image-bearing pages of a running site, extracts
  the exact `/_next/image?...` URLs they reference (every srcset width), and
  requests each so the server encodes and caches it.
- An `npm run prewarm` entry, and a `prewarm` CD job that runs it against the
  production URL after the deploy job succeeds.
- A unit test for the URL extraction and an integration test that proves warming
  flips a sampled image from `MISS` to `HIT`.

Out:
- Browser cache headers (already immutable/long - no change).
- Pre-generating variants at build time / a custom loader (heavier; on-demand +
  warming is enough for this image set).
- Re-adding AVIF (separate trade-off; see feedback 0006).

## Approach

- `scripts/lib/prewarm.mjs` - `extractImageUrls(html, origin)` (pure, testable)
  and `prewarm({ baseUrl, routes, ... })` which fetches each page, collects image
  URLs, and GETs each with a browser-like `Accept` header to trigger+cache the
  encode. Returns `{ urls, warmed, failed, pagesOk }`.
- `scripts/prewarm-images.mjs` - thin entry: base URL from argv/`SITE_URL`
  (default the production URL), routes = the four image-bearing pages. Best-
  effort: logs a summary; only exits non-zero if it could not reach the site at
  all (individual image failures never fail the deploy).
- `.github/workflows/deploy.yml` - a `prewarm` job (`needs: deploy`) checks out
  the repo, sets up Node, and runs the script against `SITE_URL`. No deps (Node
  built-in `fetch`), so no `npm ci`.

Key decision: warm by **crawling the rendered pages** rather than hardcoding
image paths/widths - the sources are content-hashed and the widths come from each
image's `sizes`, so only the live HTML knows the exact URLs. This stays correct
as images and layouts change.

## Acceptance

- [ ] `extractImageUrls` pulls every `/_next/image` URL from `src` and `srcset`,
      unescapes `&amp;`, dedupes, and absolutizes them; ignores non-image URLs.
- [ ] Running the script against a freshly booted standalone server warms all
      rendered image variants; a sampled URL then returns `X-Nextjs-Cache: HIT`.
- [ ] `prewarm` CD job runs after `deploy` and is best-effort (a warming hiccup
      does not fail an otherwise-green deploy).
- [ ] Tests green; lint + build clean.
