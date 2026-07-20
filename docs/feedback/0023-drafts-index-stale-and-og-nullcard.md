# 0023 - Gated drafts index served stale, and the preview OG route rendered a null card

## Symptom

After "Life Log #1" published at its `publishAt` and the sample fixtures were moved out of live
content (spec 0035 / feedback 0022), the author still saw the published post AND the removed samples
listed under `/blog/drafts`, and the post "missing" from the RSS feed. On inspection the **origin was
correct** - the authenticated `/blog/drafts` returned the empty state (0 previews) and the feed
contained the post. Two real issues underneath:

1. **Stale client cache on the gated index.** The `/blog/drafts` index was ISR (`revalidate = 60`),
   which makes Next emit `cache-control: s-maxage=60, stale-while-revalidate=~1yr`. For a public page
   that is fine, but this page is **gated and author-only**, so the one person who reads it (the
   author) had their browser hold a stale listing for a long time - a published/removed post appeared
   to linger even though the origin had dropped it.
2. **The preview OG route rendered a 200 blank card for a nonexistent slug.**
   `/blog/drafts/<slug>/opengraph-image` called `renderPostOgCard(getPostBySlug(slug))` with no guard,
   so a removed slug (`getPostBySlug` -> null) or an already-published one produced a mismatched card
   with a 200 instead of a 404.

(The RSS "missing" report was the reader's own poll cache; the origin feed had the post.)

## Root cause

ISR's `stale-while-revalidate` is a caching *feature* for public, high-traffic pages, but it is wrong
for a gated, low-traffic, must-be-current author tool. And a per-slug metadata route needs the same
existence/state guard as its page - the OG route had none.

## Fix

- `/blog/drafts/page.tsx`: `export const dynamic = "force-dynamic"` (was `revalidate = 60`), so the
  gated index sends `no-store` and always reflects the current preview set. Per-request rendering is
  free here (behind the login, low traffic).
- `/blog/drafts/[slug]/opengraph-image.tsx`: `if (!post || !isPreviewNow(post)) notFound()` before
  rendering, mirroring the page's guard - a removed or now-published slug 404s instead of a blank 200.
- Smoke coverage: the preview OG route 404s for a nonexistent slug; the drafts index is `no-store`.

## Learning

Rolls into `overview/learnings.md`: **ISR / `stale-while-revalidate` is for public pages; a gated,
must-be-current view (an author tool, a dashboard) should be `force-dynamic` so it never serves a
stale client copy.** And (reinforcing 0019) **a per-slug metadata/OG route needs the same
existence-and-state guard as its page** - never render a card for a `null`/wrong-state post. When a
user reports "stale content," check the ORIGIN first (curl it) before assuming a logic bug - it is
often a client/reader cache, which points at the cache-control policy, not the data layer.
