# 0015 - Reading-time badge on the blog listing

## Problem

The individual post page shows a reading-time pill (spec 0011), but the `/blog` listing rows show
only date, excerpt, and tags. A reader scanning the list cannot gauge how long each post is before
clicking in. The estimate already exists (`estimateReadingMinutes`); it just is not surfaced on the
listing.

## Outcome

Each row on `/blog` shows the same reading-time pill as the post page - a `Clock` icon + "N min
read" - next to the post's date. The estimate matches the post page exactly (same function, same
post).

## Scope

**In**
- The reading-time pill on every listing row, beside the date.
- Extract the pill into one shared presentational component so the post page and the listing render
  the identical treatment (no duplicated markup/classes).
- Pass a per-post `minutes` through the serializable listing summary.

**Out**
- Any change to the post page's behaviour (it just adopts the shared component).
- New reading-time logic (reuse `readingMinutes`/`estimateReadingMinutes`).

## Approach

- Add `minutes: number` to the `BlogListPost` summary; the Server listing page computes
  `readingMinutes(post)` per post (it already holds the full posts) and passes only the integer down
  - no post body crosses the client boundary.
- Extract `src/components/reading-time-pill.tsx` (presentational, `{ minutes }`) carrying the exact
  pill markup/classes currently inline on the post page; the post page and the client listing island
  both render it. `ClockIcon` is already a client-boundary wrapper, so a Server Component (post page)
  and a client component (island) can both render the pill.
- In the island, place the pill in the row meta next to the date (mirroring the post header's date +
  pill row).

## Acceptance

- [ ] Every `/blog` row shows a `Clock` + "N min read" pill by the date.
- [ ] The listing estimate equals the post page's for the same post.
- [ ] Post page and listing use one shared `ReadingTimePill` (no duplicated pill markup).
- [ ] Smoke test asserts "min read" on `/blog` so a revert reddens.
- [ ] lint + resume:pdf:check + build + test green.
