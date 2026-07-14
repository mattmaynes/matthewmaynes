# 0021 - Previous / next post navigation on a blog post

## Problem

A reader who finishes a post has no in-context way to move to an adjacent post; the
only onward link is "Back to blog". Chronological post-to-post navigation is a
standard, low-friction way to keep a reader reading.

## Outcome

At the bottom of each `/blog/[slug]` post, up to two navigation tiles:

- **Previous** - the chronologically older post (published before this one).
- **Next** - the chronologically newer post (published after this one).

Each tile shows the adjacent post's cover thumbnail (an OG-card-style tile), a
"Previous" / "Next" label, the post title, and - under the title - the same metadata
badges the blog listing rows carry: a **reading-time pill** ("N min read") and the
post's **tags**. Each tile links to that post. A directional arrow points the way (left
for previous, right for next).

- If there is no next post (this is the newest), only Previous shows.
- If there is no previous post (this is the oldest), only Next shows.
- On a post that is the only post, nothing shows.

**Layout.** On `sm+`: one row - Previous on the left (arrow left), Next on the right
(arrow right). On mobile: stacked, **Next first, Previous second**.

## Scope

**In**

- `src/lib/blog.js` + `blog.ts`: a pure `getAdjacentPosts(posts, slug)` returning
  `{ previous, next }` (older / newer), unit-tested against a multi-post fixture.
- `src/components/post-nav.tsx`: the presentational tiles + responsive layout. Each
  `PostNavItem` carries `minutes` and `tags` and renders a badges row (reading-time pill +
  tag chips) under the title; the tiles grow taller to fit the extra row.
- Arrow glyphs in `blog-icons.tsx`.
- Wire into `src/app/blog/[slug]/page.tsx` (resolve covers server-side, thread `minutes`
  and `tags` - both already computed there - render at the bottom).
- Smoke + doc updates.

**Out**

- Related-by-tag or "you might also like" recommendations (this is strictly
  chronological adjacency).
- Excerpts or any other tile metadata beyond reading time + tags (matching the listing rows).
- Any change to post content, frontmatter, or the listing.

## Approach

- **Adjacency is collection logic, so it lives in a pure, fs-free-testable core**
  (`blog.js`), not inline in the page - the repo's recurring lesson (learnings 0009):
  a single-post content dir would never exercise the ordering, so the function is
  tested against a multi-post fixture. `getAdjacentPosts` sorts newest-first (reusing
  `sortPostsNewestFirst`, non-mutating), finds the slug, and returns the neighbours:
  `next` = the newer post (index - 1), `previous` = the older post (index + 1); each is
  `null` at the boundary or when the slug is absent.
- **`PostNav` is presentational only** (no hooks / server APIs), so it renders inside
  the Server-Component post page like `ReadingTimePill`. It takes already-resolved
  `previous` / `next` props (slug, title, the static-imported cover, plus `minutes` and
  `tags`), so cover resolution stays on the server (the `blog-images.ts` static-import
  pattern, learnings 0005). Mobile-first: `flex flex-col-reverse` puts Next (second in DOM)
  on top and Previous below; `sm:flex-row sm:justify-between` lays Previous left / Next
  right. When only one side exists, the container aligns it to its correct edge
  (`sm:justify-start` / `sm:justify-end`) so a lone Next still sits on the right.
- **Metadata badges reuse the listing treatment.** The post page already calls
  `getAdjacentPosts` (returning full `Post` objects) and `readingMinutes`, so `toNavItem`
  adds `minutes: readingMinutes(p)` and `tags: p.tags` - no new data source. The tile
  renders the shared `ReadingTimePill` and the same rounded tag chips the listing/post use,
  in a `flex-wrap` row under the title. The cover stays vertically centred (`items-center`)
  so it centres against the now-taller text block. The Next tile is
  `flex-row-reverse text-right`, so its badges row right-aligns (`justify-end`) to hug the
  same edge as the label/title; the Previous tile's left-align.
- **Placement.** After the subscribe block, before the "Back to blog" / RSS row, so the
  bottom of the post reads: content -> disclaimer -> subscribe -> prev/next -> back.

## Acceptance

- [ ] On a post with an older post, a Previous tile links to it (arrow left); on a post
      with a newer post, a Next tile links to it (arrow right). Each tile shows a
      reading-time pill and the neighbour post's tags under the title, and is taller to fit
      them; the Next tile's badges right-align, the Previous tile's left-align.
- [ ] Newest post shows only Previous; oldest shows only Next; a lone post shows
      neither.
- [ ] `sm+`: Previous left / Next right on one row. Mobile: stacked, Next above
      Previous.
- [ ] `getAdjacentPosts` is unit-tested against a multi-post fixture: correct
      older/newer neighbours, both boundaries, an unknown slug (both null), and
      non-mutation of the input.
- [ ] Smoke: the newest post's page (the AI post) renders a Previous tile to
      `i-picked-the-wrong-elective`; the `i-picked` page renders a Next tile to the AI
      post. Each asserts the direction label + the adjacent post's href. Within the post-nav
      block, the neighbour's reading-time ("min read") and each of its tags render (scoped
      to the `nav` block so a tag in prose can't false-pass).
- [ ] `npm run lint`, `npm test`, and `npm run build` are green; verified in a real browser.
