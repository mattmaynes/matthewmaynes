# 0034 - Draft blog posts (hidden, previewable under /blog/drafts)

## Problem

A finished-enough post has nowhere to live except published. The content pipeline (spec 0009)
loads every `content/blog/*.mdx` into `getAllPosts()`, and every surface - the `/blog` listing, the
home-page latest, `/subscribe`, the RSS feed, the sitemap, the tag pages - enumerates that one set.
Dating a post in the future does not hide it (only the "New" badge honours the future date; the post
still lists and renders). So there is no way to keep a draft in the repo, preview it as it will
actually look, and hold it back from readers until it is ready. The immediate trigger: a written,
cover-ready post ("The Car That Taught Me How to Decide") needs to come off the live site without
being deleted.

## Outcome

- **A `draft` flag.** A post with `draft: true` in its frontmatter is a draft; absent or `false` is
  published. Existing posts (no `draft` key) are published, unchanged.
- **Hidden from every linked/public surface.** A draft never appears on `/blog`, the home-page latest
  slot, `/subscribe`, the RSS feed, the sitemap, a tag page, the "New" badge, or a published post's
  previous/next nav.
- **Its own space under `/blog/drafts`.** `GET /blog/drafts` lists all drafts (newest-first, the same
  card UI as `/blog`), each linking to `/blog/drafts/<slug>`. `GET /blog/drafts/<slug>` renders the
  draft with the full post treatment (hero, body, breadcrumbs) so it previews exactly as it will look
  once published, plus a visible **"Draft"** marker.
- **Not indexed, not linked.** `/blog/drafts` and every `/blog/drafts/<slug>` emit `robots: noindex`
  and are absent from the sitemap, the feed, and all navigation. They are reachable only by knowing
  the URL (security-by-obscurity, which is acceptable - drafts are not secret).
- **Publishing is one edit.** Removing `draft: true` moves the post from `/blog/drafts/<slug>` to
  `/blog/<slug>` and onto every public surface, with no file move.
- **A published slug and a draft slug do not collide.** A published post is served only at
  `/blog/<slug>`; a draft only at `/blog/drafts/<slug>`. Requesting the wrong kind at either route
  404s.

## Scope

**In**

- `draft?: boolean` on `Frontmatter` and `Post`; parsed in `readPost` (a bare `draft: true` line;
  any other value, or absence, is `false`). Optional, so no existing post breaks.
- Pure seams in `blog.ts`: `getPublishedPosts()` (drafts filtered out) and `getDraftPosts()` (only
  drafts), both preserving `getAllPosts()`'s newest-first order. `getAllPosts()` stays unfiltered
  (the internal source). Unit-tested over a multi-item fixture (learnings 0009).
- Point every **public** enumeration at `getPublishedPosts()`: the `/blog` listing + its "New" badge
  and tag derivation, the home-page latest, `/subscribe`, the RSS feed, the sitemap, the tag pages
  (`generateStaticParams`, `generateMetadata`, render), and the published `[slug]` page's `generateStaticParams`,
  its OG-image `generateStaticParams`, and its previous/next nav (`getAdjacentPosts`).
- New route `src/app/blog/drafts/page.tsx`: the drafts index over `getDraftPosts()`, reusing the
  existing `toPostRows` + `BlogList`/`PostRow` UI, linking rows to `/blog/drafts/<slug>`; `noindex`.
- New route `src/app/blog/drafts/[slug]/page.tsx`: `generateStaticParams` over `getDraftPosts()`,
  `generateMetadata` (`noindex`), body renders the shared post view with a "Draft" marker; a slug that
  is not a draft → `notFound()`.
- Extract the post-article rendering shared by the published and draft post pages into one component
  (`src/components/post-article.tsx`), parameterised by the base path (for prev/next + breadcrumb
  links) and an `isDraft` marker, so a draft previews identically to a published post and the two
  routes do not diverge.
- The published `[slug]` page 404s when the slug resolves to a draft (it lives at `/blog/drafts/<slug>`).
- Mark `content/blog/the-car-that-taught-me-how-to-decide.mdx` `draft: true`.
- Smoke + unit coverage (see Approach).

**Out**

- Any access control / authentication for drafts. Explicitly not wanted: reachable-by-URL is fine.
- A per-draft Open Graph card. `/blog/drafts/<slug>` inherits the site-level `opengraph-image`; a
  bespoke card is pointless for a `noindex`, unshared page.
- Scheduled / timed publishing, a draft-editing UI, or a redirect from an old `/blog/drafts/<slug>`
  URL to `/blog/<slug>` after publishing. Each is its own later spec if wanted.
- Changing the `/blog` listing's interactive tag/search filter (spec 0012). It keeps working over the
  published set; no `?drafts=` query param is added.

## Approach

- **`draft` parsing (fs seam).** In `parseFrontmatter`, recognise `draft` alongside the existing keys
  and coerce to boolean (`value === "true"`); `readPost` carries it onto the `Post`. A missing key is
  `false`, so the required-field check is untouched and every current post stays published.
- **Two pure filters, one source.** `getPublishedPosts = () => getAllPosts().filter(p => !p.draft)`
  and `getDraftPosts = () => getAllPosts().filter(p => p.draft)`. `getAllPosts()` remains the single
  fs read and the newest-first sort; the filters are pure derivations of it, so they are covered by a
  multi-item fixture (mixed draft/published) asserting membership *and* preserved order - the
  collection-logic test lesson (learnings 0009), not a single-post fixture that never exercises the
  filter.
- **Public surfaces switch to `getPublishedPosts()`.** Each call site named in Scope swaps
  `getAllPosts()` → `getPublishedPosts()`. This is the whole hiding mechanism; a draft simply is not
  in the set those surfaces map over. The "New" badge slug and tag derivation are computed over the
  published set at each caller (learnings 0016: a whole-corpus fact is computed by the caller over the
  full *published* corpus and passed down, never recomputed from a subset).
- **Drafts index.** `src/app/blog/drafts/page.tsx` is a Server Component (no client URL state, so no
  `useSearchParams` bailout - learnings 0012 does not apply): it maps `getDraftPosts()` through
  `toPostRows` and renders `BlogList`, with each row's href pointing at `/blog/drafts/<slug>`. Because
  `PostRow` today hard-codes `/blog/<slug>`, thread an optional `basePath` (default `/blog`) through
  `toPostRows` → `PostRowData` → `PostRow` so the draft index links to the draft route. `metadata`
  sets `robots: { index: false, follow: false }`. Empty drafts → the same "no posts" empty state.
- **Draft post route.** `src/app/blog/drafts/[slug]/page.tsx` mirrors the published `[slug]` page but
  over drafts: `generateStaticParams` enumerates `getDraftPosts()` (so each draft is prerendered and
  reachable), `generateMetadata` marks `noindex`, and the body renders the shared `PostArticle` with
  `isDraft` (which shows a "Draft" pill in the hero/header) and `basePath="/blog/drafts"`. If
  `getPostBySlug(slug)` is missing or not a draft → `notFound()`.
- **Shared article component.** The published page's body (breadcrumbs, hero/cover + `HeroMeta`,
  `PostBody`, prev/next `PostNav`, subscribe CTA) moves into `src/components/post-article.tsx`, taking
  `{ post, previous, next, minutes, isDraft, basePath }`. Both routes become thin shells that resolve
  the post (published vs draft), compute adjacency over the matching set (published neighbours for a
  published post; draft neighbours for a draft), and render the component. Breadcrumb and nav hrefs
  derive from `basePath` (`/blog` vs `/blog/drafts`). Keeps a draft's preview pixel-identical to its
  published form and prevents the two routes drifting.
- **Route precedence / reserved path.** Next resolves the static segment `drafts` before the dynamic
  `[slug]`, so `/blog/drafts` is the index and `/blog/<other>` is a post; `/blog/drafts/<slug>` is the
  nested dynamic route. The cost is that `drafts` becomes a reserved post slug - a post titled "Drafts"
  (slug `drafts`) would be shadowed. Vanishingly unlikely; note it in the spec, no code guard.
- **Tests.**
  - Unit (fs-free-ish, over a fixture): `getPublishedPosts` excludes drafts and keeps newest-first;
    `getDraftPosts` returns only drafts; `parseFrontmatter` reads `draft: true` and defaults absent to
    `false`.
  - Feed: `buildBlogFeed` over a mixed set (or the route) excludes the draft's URL/title.
  - Smoke (must be able to fail - learnings 0001/0003): `/blog/drafts` returns 200 with the draft's
    title and `noindex`; `/blog/drafts/<slug>` returns 200 with the post body and a "Draft" marker and
    `noindex`; `/blog` and the RSS feed do **not** contain the draft's title; the published `[slug]`
    route 404s for a draft slug; `/blog/drafts/<slug>` 404s for a published slug.

## Acceptance

- [ ] A post with `draft: true` is absent from `/blog`, the home latest slot, `/subscribe`, `GET
      /blog/feed.xml`, `GET /sitemap.xml`, every tag page, the "New" badge, and any published post's
      previous/next nav.
- [ ] `GET /blog/drafts` returns 200, lists every draft newest-first (linking to `/blog/drafts/<slug>`),
      and emits `robots: noindex`; it is not linked from any nav and not in the sitemap/feed.
- [ ] `GET /blog/drafts/<slug>` returns 200, renders the full post treatment plus a visible "Draft"
      marker, and emits `robots: noindex`.
- [ ] The published `GET /blog/<slug>` 404s when `<slug>` is a draft; `GET /blog/drafts/<slug>` 404s
      when `<slug>` is published.
- [ ] Removing `draft: true` publishes the post (it leaves `/blog/drafts` and appears on `/blog` and
      the feed) with no file move.
- [ ] `getPublishedPosts`/`getDraftPosts` and `draft` parsing have unit tests over a multi-item
      fixture; the feed test proves a draft is excluded.
- [ ] `content/blog/the-car-that-taught-me-how-to-decide.mdx` carries `draft: true` and is hidden
      accordingly.
- [ ] `npm run lint`, `npm test`, `npm run build` green; smoke covers the draft index, a draft page
      (marker + noindex), the published-listing/feed exclusion, and both 404 directions.
