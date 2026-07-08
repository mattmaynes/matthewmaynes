# 0027 - Blog tag pages (indexable per-tag archives)

## Problem

Tags on the blog are discoverable only as **client-side** state. On `/blog` the chips push a
`?tag=` value into the URL and a client island (`blog-list.tsx`) filters the already-rendered list
in the browser; the tag pills on an individual post are inert text. To a crawler, `/blog` is a
single page and `?tag=` variants are not distinct URLs, so no tag has its own indexable landing
page. A reader (or a search engine) arriving on "imposter syndrome" or "first software job" has
nowhere to land that is *about* that topic, and the post pages offer no internal link that groups
related posts. As the blog grows, that is a missed discovery and SEO surface.

## Outcome

- **A real page per tag.** `GET /blog/tags/<slug>` renders every post carrying that tag,
  newest-first, as a statically generated route (one per tag, baked at build via
  `generateStaticParams`). A slug like `imposter-syndrome` maps back to the `Imposter Syndrome`
  tag case-insensitively.
- **Every tag, present and future.** All tags get a page - including a tag with a single post - and
  a future tag gets one automatically the next build, because the params derive from the posts. No
  minimum-post threshold, no per-tag config.
- **Its own SEO identity.** Each tag page sets a unique `<title>` (`Posts tagged "<Tag>" - Blog`)
  and meta description, so it is a distinct indexable/shareable document rather than a duplicate of
  `/blog`.
- **Internal links in.** The tag pills on a post page become links to the matching tag page, giving
  crawlers a path to every archive and grouping related posts for readers.
- **Crawlable.** `sitemap.xml` lists every tag page - and, closing a pre-existing gap, every
  individual post (today the sitemap lists only nav routes + `/subscribe`, not posts at all).
- **Unknown tag → 404.** A slug that matches no tag returns `notFound()`, like an unknown post slug.

## Scope

**In**

- New route `src/app/blog/tags/[tag]/page.tsx`: `generateStaticParams` over all tags,
  `generateMetadata` (title + description), body renders the filtered, newest-first post list with
  the site's existing card/token styling and a heading naming the tag.
- Pure, fs-free tag-slug helpers in `src/lib/blog-view.ts` (`tagSlug`, `tagFromSlug`), unit-tested
  by `node --test` - the shared home the Server route and any client caller both import (learnings
  0012). Consolidate the existing `slugify` (today in the fs-coupled `blog.ts`) into `blog-view.ts`
  and re-export it from `blog.ts` so there is one slugifier, not two.
- Link the post-page tag pills (`src/app/blog/[slug]/page.tsx`, all three render spots: overlay
  hero, mobile hero, no-cover header) to `/blog/tags/<slug>` via Next `<Link>`, styling unchanged.
- Extend `src/app/sitemap.ts` to include every post URL (`lastModified` = post date) and every tag
  page URL.
- Smoke coverage: a tag page renders its posts and its route-unique `<title>`/heading; an unknown
  tag 404s; `sitemap.xml` contains a post URL and a tag URL.

**Out**

- Per-tag Open Graph cards. Tag pages inherit the site-level `opengraph-image`; a bespoke per-tag
  card (like the per-post one) is a later enhancement, not needed to ship indexable pages.
- Changing the `/blog` listing's interactive filter. The client `?tag=` filter stays as the
  browse/search surface; tag pages are the additive SEO/landing surface. (The listing chips could
  later point at tag pages, but that is not required here and would regress the in-place filter.)
- Per-tag RSS feeds, pagination, tag descriptions/intro copy, a tag index (`/blog/tags`). Current
  volume does not need them; each is its own small spec if wanted.
- A minimum-post threshold for generating a page (explicitly not wanted - all tags get a page).

## Approach

- **Route as a Server Component**, mirroring `blog/[slug]/page.tsx`: `generateStaticParams()` returns
  `deriveTags(getAllPosts()).map(t => ({ tag: tagSlug(t) }))`, so every tag is prerendered - static,
  no client island, no `useSearchParams` bailout (learnings 0012 is about client URL state; this
  route has none). The body resolves the slug back with `tagFromSlug(slug, deriveTags(posts))`;
  `null` → `notFound()`. It filters with the existing pure `filterPosts(posts, tag, "")` and renders
  the posts newest-first (the posts are already newest-first from `getAllPosts`).
- **Slug helpers (pure, fs-free).** `tagSlug` is the existing `slugify` (lowercase,
  non-alphanumerics → single dash, trim dashes): `Imposter Syndrome` → `imposter-syndrome`,
  `Objective-C` → `objective-c`. `tagFromSlug(slug, tags)` returns the first tag whose `tagSlug`
  equals the given slug, else `null`. Trade-off: two distinct tags could in principle slugify to the
  same slug (e.g. `A.I.` vs `AI`); first-match wins and `generateStaticParams` dedupes by slug -
  acceptable at this scale, and `deriveTags` already dedupes tags case-insensitively. Living in
  `blog-view.ts` keeps them `node --test`-importable without `node:fs` (the same reason
  `deriveTags`/`filterPosts` live there).
- **One slugifier.** Move `slugify` from `blog.ts` to `blog-view.ts` and have `blog.ts` re-export it
  (it already re-exports `formatPostDate` from there), so the filename-vs-title build check and the
  tag slug share one implementation - no divergence (learnings 0018: migrate callers, don't fork).
- **Metadata.** `generateMetadata` sets `title: 'Posts tagged "<Tag>" - Blog'` and a description
  naming the tag and post count; `metadataBase` (already set in `layout.tsx`) makes canonical/OG
  URLs absolute. Unknown slug → minimal `{ title: "Blog" }` (the page itself 404s).
- **Post-page links.** Wrap each hero tag pill in `<Link href={/blog/tags/${tagSlug(tag)}}>`,
  keeping the pill classes on the link so the visual is unchanged; the `<li>` stays the list item.
- **Sitemap.** Add `getAllPosts()` post URLs (`/blog/<slug>`, `lastModified` = the post's date) and
  `deriveTags(...).map(tagSlug)` tag URLs to the existing `nav` + `EXTRA_ROUTES` set, all joined
  against `site.url` as today. This also fixes the standing gap that posts were never in the sitemap.
- **Tests.** Unit-test `tagSlug`/`tagFromSlug` (round-trip, unknown → null, case-insensitive,
  dedupe) in the existing `blog` view tests - pure, no server. Add smoke assertions (they must be
  able to fail, learnings 0001/0003): a known tag page returns 200 with its route-unique title and a
  known post's title in the list; an unknown tag slug returns 404; `GET /sitemap.xml` contains a
  `/blog/<slug>` and a `/blog/tags/<slug>` URL.

## Acceptance

- [ ] `GET /blog/tags/<slug>` renders newest-first every post with that tag, with a heading naming
      the tag and a route-unique `<title>` (`Posts tagged "<Tag>" - Blog`).
- [ ] Every tag (from any post, including single-post tags) has a page, baked via
      `generateStaticParams`; a newly added tag gets a page on the next build with no config change.
- [ ] An unknown tag slug returns 404 (`notFound()`).
- [ ] Each tag pill on a post page links to its tag page; styling is unchanged.
- [ ] `sitemap.xml` lists every post URL and every tag page URL (absolute, against `site.url`).
- [ ] `tagSlug`/`tagFromSlug` have unit tests (round-trip, unknown → null, case-insensitive) in the
      fs-free view suite; `slugify` has a single implementation shared by `blog.ts` and the tag helper.
- [ ] `npm run lint`, `npm test`, `npm run build` green; smoke covers a tag page (title + a listed
      post), the 404, and the sitemap entries.
