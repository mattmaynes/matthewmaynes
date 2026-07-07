# 0023 - Reading-time + tag badges on the previous/next post tiles

## Problem

The previous/next post tiles (spec 0021) show only a cover thumbnail, a direction
label, and the title. That is a thin preview - a reader deciding whether to click has
no sense of the post's length or topic.

## Outcome

Each previous/next tile also shows, under the title, the same metadata badges the
blog listing rows carry: a **reading-time pill** ("N min read") and the post's
**tags**. The tiles grow taller to fit the extra row.

## Scope

**In**

- `PostNavItem` gains `minutes` and `tags`; the post page threads them in (it already
  computes both).
- `PostNav`'s tile renders a badges row (reading-time pill + tag chips) under the
  title.
- Smoke + doc updates.

**Out**

- Excerpts or any other metadata on the tiles (kept to reading time + tags, matching
  the listing rows).
- Changes to which posts are adjacent, the left/right/stacking layout, or the lone-tile
  behaviour (all spec 0021, unchanged).

## Approach

- **Thread the data through the existing server resolution.** The post page already
  calls `getAdjacentPosts` (which returns full `Post` objects) and `readingMinutes`, so
  `toNavItem` just adds `minutes: readingMinutes(p)` and `tags: p.tags` - no new data
  source.
- **Reuse the listing's badge treatment.** The tile renders the shared `ReadingTimePill`
  and the same rounded tag chips the listing/post use, in a `flex-wrap` row under the
  title. The cover stays vertically centred (`items-center`, matching the listing row's
  `self-center` cover), so it centres against the now-taller text block.
- **Mirror correctly for the Next tile.** The Next tile is `flex-row-reverse text-right`;
  the badges row right-aligns (`justify-end`) there so the metadata hugs the same edge as
  the label/title.

## Acceptance

- [ ] Each previous/next tile shows a reading-time pill and the neighbour post's tags
      under the title; the tile is taller to fit them.
- [ ] The Next tile's badges right-align (with its right-aligned label/title); the
      Previous tile's left-align.
- [ ] Smoke: within the post-nav block on a post, the neighbour's reading-time ("min
      read") and each of its tags render (scoped to the `nav` block so a tag in prose
      can't false-pass).
- [ ] `npm run lint`, `npm test`, `npm run build` green; verified in a real browser.
