# 0019 - Scheduled post's OG card leaked before publishAt (metadata route not runtime-gated)

## Symptom

In the spec 0035 review, three personas (security **blocker**, architect **major**, engineer minor)
flagged the same hole: `/blog/<slug>/opengraph-image` rendered a not-yet-due scheduled post's real
card - title, tags, cover art - before its `publishAt`, while the sibling `page.tsx` correctly 404'd
via `isPublishedNow`. The embargoed card was publicly fetchable ahead of time on every scheduled post.

## Root cause

`generateStaticParams` for the OG route enumerates `getPublishedPosts()` (published-only at build), so
we assumed the route was "published-only". But `dynamicParams` defaults to **true**, and this PR added
`export const revalidate = 60` to the route - so a request to a non-baked slug (a scheduled post)
renders **on demand** through `renderPostOgCard(getPostBySlug(slug))`, which had no state guard. Build-
time enumeration is not a runtime access control.

This is a re-make, in a new form, of the exact class already logged in feedback 0017 and in
`learnings.md` ("an exclusion rule needs a direct marker on EVERY surface ... OG card"). 0034 got the
page and its OG card right by enumeration; 0035 changed the runtime (dynamic on-demand + ISR) and the
enumeration stopped being sufficient, but the OG route did not gain the runtime guard its page has.

## Fix

Gate the published OG route's default export the same way as its page:
`if (!post || !isPublishedNow(post)) notFound();` before `renderPostOgCard(post)`
(`src/app/blog/[slug]/opengraph-image.tsx`). Added a smoke assertion that a not-yet-due scheduled
slug returns **404** at `/blog/<slug>/opengraph-image`, plus a home-page absence guard. The not-yet-
public card still renders under `/blog/drafts/<slug>/opengraph-image`.

## Learning

`generateStaticParams` scoping is **not** access control: with `dynamicParams` defaulting to true, any
un-baked slug still renders on demand. A per-slug **metadata/OG route must carry the SAME runtime
state guard as its page** (`isPublishedNow` + `notFound()`), not rely on build-time enumeration -
especially once the route is dynamic/ISR. Generalises the "exclusion rule needs a marker on every
surface" learning to its runtime form: the page's guard and its co-located metadata routes must be
kept in lockstep, and each exclusion needs a failable per-surface smoke assertion (the OG-route 404
was previously untested).
