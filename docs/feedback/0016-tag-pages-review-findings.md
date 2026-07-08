# 0016 - Tag pages: persona review findings (spec 0027, PR #91)

## Symptom

Six personas reviewed PR #91 (blog tag pages). Two **major** findings and a handful of minors:

1. **The "New" badge was tag-local, not global** (engineer major, architect minor). `toPostRows`
   computed `newPostSlug` over the array it was handed. The listing passed all posts (so the badge
   was global), but the tag page passed the *filtered* subset - so a post that was the newest
   *within a tag* and inside the 30-day window rendered "New" on that tag page even when it was not
   the globally-newest post and carried no badge on `/blog`. That directly contradicted the
   invariant the code's own comment claimed ("the same badge on the listing and on a tag page").
2. **No test guarded the post-page tag pills linking** (tester major). The pills becoming `<Link>`s
   (acceptance #4) had no assertion; the only `/blog/tags/` fetches hit the route directly. Reverting
   the three pills back to inert `<li>` would have shipped green.

Minors: `generateMetadata` re-read every post file twice; the "All posts" back link had no
focus-visible ring (keyboard a11y); `src/lib/post-summaries.ts` imported its row type *up* from
`src/components` (layering inversion); the tag archive's newest-first ordering and the `blog_tag`
subscribe source were untested; and (nit) the `blog_tag` conversion carries no tag dimension.

## Root cause

1. A mapping helper that also *derived* the badge conflated two concerns - "which post is globally
   new" is a property of the whole corpus, but it was recomputed per-caller from whatever subset the
   caller passed. A subset-derived global fact is wrong for any caller that passes a subset.
2. The recurring "a behaviour change needs a guard that can actually fail" gap (learnings 0005/0009):
   the linkification was verified by eye, not by a test that fails on revert.

## Fix

1. `toPostRows(posts, newSlug)` now takes the badge slug as an explicit argument; both callers
   compute it once over the **full** post set (`newPostSlug(getAllPosts(), NOW_MS, 30)`) and pass it,
   so the badge is global by construction and the tag page cannot badge tag-locally.
2. Smoke test now fetches a post carrying the archive's tag and asserts
   `href="/blog/tags/<slug>"` is present, plus the subscribe form's presence on the tag page and a
   future-proof newest-first ordering check (a no-op until a tag has 2+ posts).
3. Minors: reuse one `getAllPosts()` in `generateMetadata`; add the shared `FOCUS_RING` to the back
   link; move `PostRowData`/`Cover` into the fs-free `blog-view.ts` core (so `src/lib` no longer
   imports up into `src/components`), re-exported from `post-row.tsx` for component callers. The
   `blog_tag`-with-tag-dimension nit is deferred deliberately (consistent with `blog_post` omitting
   the slug; the tag is recoverable from the `$pageview` path).

## Learning

A derived "global" fact (the newest-post badge) must be computed once over the whole corpus and
**passed down**, never recomputed inside a mapper from whatever subset it receives - a subset input
silently produces a wrong "global" answer, and the bug is invisible on the one caller that happens to
pass the full set. When one function serves both a full-list and a filtered-list caller, hoist any
whole-corpus fact to the callers. (Rolled into `overview/learnings.md`.)
