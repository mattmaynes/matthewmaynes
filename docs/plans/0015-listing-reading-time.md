# Plan 0015 - Reading-time badge on the blog listing

Source spec: `docs/specs/0015-listing-reading-time.md`.

## Steps

1. Extract `src/components/reading-time-pill.tsx` - a presentational `ReadingTimePill({ minutes })`
   carrying the exact pill markup/classes that were inline on the post page (`Clock` + "N min read").
2. Post page (`src/app/blog/[slug]/page.tsx`): render `<ReadingTimePill minutes={minutes} />`; drop
   the now-unused `ClockIcon` import (keep `RssIcon`). No behaviour change.
3. `BlogListPost` (`src/components/blog-list.tsx`): add `minutes: number`.
4. Listing page (`src/app/blog/page.tsx`): compute `readingMinutes(post)` per post and set
   `minutes` on each summary (only the integer crosses the client boundary, not the body).
5. Island (`blog-list.tsx`): render `<ReadingTimePill minutes={post.minutes} />` in a flex row next
   to the date (mirrors the post header's date + pill row).
6. Smoke (`tests/smoke.test.mjs`): add `"min read"` to the `/blog` case `contains` so a revert
   reddens. (`estimateReadingMinutes` is already unit-tested; no new unit test needed.)
7. Reflect: `docs/overview/features.md` `/blog` row now lists the reading-time pill.

## Verification

- [ ] `npm ci`, `npm run lint`, `npm run resume:pdf:check`, `npm run build`, `npm test` all green.
- [ ] `/blog` rows show the pill; estimate equals the post page's; post + listing share one component.
