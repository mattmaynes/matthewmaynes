# 0024 - Post images/covers render oversized on desktop

## Symptom

On desktop, blog post media rendered far too large - a tall/portrait cover or in-body
photo/screenshot filled (or overflowed) the viewport. The worst case was the Life Log #1 cover
(intrinsic 895x1194): rendered at the full reading-column width (~847px) it became ~1129px tall and
took over the entire screen. The newest post's near-square cover was similarly prominent. Reported
on the live site for the two most recent posts.

## Root cause

`PostImage` and the cover hero (`post-article.tsx`) only capped **width** (`w-full` / `max-w-full`
to the reading column) and let **height** follow the aspect ratio unbounded. A portrait or
near-square image at column width is therefore very tall. Notably `PostVideo` already solved this
for clips (it caps a portrait clip at `75vh`), but images and the cover never got the same rule -
the constraint was inconsistent across the three media types.

## Fix

Introduce one shared standard, `POST_MEDIA_MAX_HEIGHT = "min(75vh, 720px)"`, and a pure helper
`postMediaMaxWidth(width, height)` in `blog-view.ts` that bounds the media's **width** to
`height-cap * aspect` (wrapped in `min(100%, ...)`). Bounding width makes the rendered **height**
land on the cap while preserving the aspect ratio, and never exceeds the column:

- **In-body `<PostImage>`** wraps the image in a centred block carrying that `max-width`.
- **The cover hero** carries the same `max-width` on its (now `mx-auto`) container, so the overlaid
  title/byline still sit over the (narrower, centred) cover; a landscape cover is unaffected because
  `cap * aspect` exceeds the column, so `min(100%, ...)` resolves to full width.

`<PostVideo>` (which already had a bare `75vh` cap) is folded onto the same helper too, so all three
media types share one constant and cannot drift apart.

Result: a portrait cover/photo shrinks toward phone size (Life Log cover 847x1129 -> 505x674),
landscape/near-square media stays as wide as the column but is height-bounded, and everything
adapts down on a shorter laptop via the `75vh` term.

## Learning

**When media fills a fixed-width column, cap its HEIGHT (viewport-aware), not just its width - a
portrait/near-square asset at column width is unbounded in height and takes over the screen.** Bound
the width to `height-cap * aspect` (wrapped in `min(100%, ...)`) so the height lands on the cap with
the ratio preserved and landscape media stays full width. Apply the SAME rule across every media
type in the surface (image, cover, video) from one shared constant, so they cannot drift apart -
the video already had a `75vh` cap the images silently lacked. This generalizes past this fix, so it
feeds `overview/learnings.md`.
