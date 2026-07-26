# 0040 - SEO & AEO metadata - build plan

Source: `docs/specs/0040-seo-aeo-metadata.md`. Build in worktree `.worktrees/seo-aeo` on branch
`0040-seo-aeo-metadata`. Test before commit.

## Steps

1. **`src/lib/structured-data.ts`** (pure, fs-free) - JSON-LD builders returning plain objects:
   - `personJsonLd()` - moved from `layout.tsx`, enriched: `worksFor` `{ "@type": "Organization",
     name: resume.work[0].company }`, `description` (from `site.description`), `knowsAbout` (a small
     curated array, e.g. drawn from `resume.skills`). Keeps existing `sameAs`, `jobTitle`, `image`.
   - `websiteJsonLd()` - `@type: WebSite`, `url`, `name`, `description`, `publisher`/`author` -> Person ref (`{"@id"}` or inline name+url).
   - `blogJsonLd()` - `@type: Blog`, `url: /blog`, `name` (`blogFeedTitle`), `description`, author -> Person.
   - `blogPostingJsonLd(post, { minutes })` - `@type: BlogPosting`, `headline`, `description`
     (excerpt), `datePublished`/`dateModified` (ISO from `post.date`), `author` (Person),
     `image` (absolute `/blog/<slug>/opengraph-image` or cover), `keywords` (tags joined),
     `articleSection` (category), `wordCount` (from body), `mainEntityOfPage` (post URL),
     `url` (post URL).
   - `breadcrumbListJsonLd(items)` - `@type: BreadcrumbList`, ordered `ListItem`s.
   - All URL joins go through `new URL(path, site.url).toString()`.
   - Unit-testable: no fs, no React.

2. **`src/components/json-ld.tsx`** - one presentational `<JsonLd data={obj} />` that renders
   `<script type="application/ld+json">` with `JSON.stringify(data).replace(/</g, "\\u003c")`
   (the exact escaping already inline in `layout.tsx`). Server-safe, hook-free.

3. **`layout.tsx`** - replace the inline `personJsonLd` const + inline `<script>` with
   `<JsonLd data={personJsonLd()} />`. No behaviour change beyond the enrichment in step 1.

4. **`src/lib/llms.ts`** (pure, fs-free) - `buildLlmsTxt({ site, nav, posts })` returning a markdown
   string: `# {name}` H1, a one-paragraph intro (tagline + description), a `## Pages` list of nav +
   key extra routes with absolute URLs, a `## Writing` list of every post (`- [title](absolute-url)
   - YYYY-MM-DD - excerpt`), and a `## More` section linking the RSS feed and `/ai-policy`. Absolute
   URLs via `new URL`. Deterministic (no `Date.now()`), like `rss.ts`.

5. **`src/app/llms.txt/route.ts`** - `export const revalidate = 60;` thin `GET` that loads
   `getPublishedPosts()` and returns `buildLlmsTxt(...)` with `Content-Type: text/plain; charset=utf-8`.
   (Route dir literally named `llms.txt` so it serves at `/llms.txt`, mirroring `blog/feed.xml`.)

6. **`src/app/page.tsx`** - render `<JsonLd data={websiteJsonLd()} />`. Add `alternates.canonical: "/"`.

7. **`src/app/blog/page.tsx`** - render `<JsonLd data={blogJsonLd()} />`. Add
   `alternates.canonical: "/blog"` (merge into the existing `alternates` block that already carries
   the RSS `types`).

8. **`src/app/blog/[slug]/page.tsx`** - in the published render (after the `isPublishedNow` guard),
   render `<JsonLd data={blogPostingJsonLd(post, { minutes })} />` and
   `<JsonLd data={breadcrumbListJsonLd([Home, Blog, post.title])} />`. Add
   `alternates.canonical: "/blog/${slug}"` to `generateMetadata` (only on the published branch;
   the 404 branch stays minimal). Do **not** touch `/blog/drafts/[slug]`.

9. **Canonicals on the remaining pages** - add `alternates.canonical` to: `/about`, `/resume`,
   `/projects`, `/projects/[slug]`, `/blog/tags/[tag]`, `/blog/categories/[slug]`, `/contact`,
   `/subscribe`, `/links`, `/privacy`, `/ai-policy`. Path-relative strings. Leave `/login` and
   `/blog/drafts*` untouched (noindex).

10. **Tests** (`tests/*.test.ts`, Node `node:test`, serialized runner already configured):
    - `llms.test.ts` - feed a multi-post fixture (>=2 posts incl. a draft): assert every published
      post title + absolute URL present, draft absent, intro + section headers present, output
      stable/deterministic.
    - `structured-data.test.ts` - assert `blogPostingJsonLd` carries the required fields with correct
      values from a fixture post; `@context`/`@type` present on each builder; `personJsonLd` has
      `worksFor`/`knowsAbout`.
    - Extend the existing metadata/route smoke test (or add one) to hit `/llms.txt` -> `200` +
      `text/plain` naming a known post, and assert a built published post page emits `BlogPosting`
      while a draft page does not, and that a canonical link is emitted. Follow the repo pattern of
      building the app under test where an existing test already does so; otherwise assert on the
      pure builders + `generateMetadata` return values (canonical) to stay server-free where possible.

11. **Verify** - `npm run lint && npm run build && npm test` all green in the worktree. Fetch
    `/llms.txt` from the built server and eyeball it; grep a built post's HTML for `BlogPosting`.

## Files touched

- New: `src/lib/structured-data.ts`, `src/lib/llms.ts`, `src/components/json-ld.tsx`,
  `src/app/llms.txt/route.ts`, `tests/llms.test.ts`, `tests/structured-data.test.ts`.
- Edited: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/blog/page.tsx`,
  `src/app/blog/[slug]/page.tsx`, and the canonical additions in step 9's pages.
- Docs: this plan + the spec; `docs/overview/{features,architecture}.md` in the reflect step.

## Verification checklist (maps to spec Acceptance)

- `/llms.txt` 200 + text/plain, published posts only.
- One self-referential canonical per indexable page; none on noindex routes.
- Published post emits BlogPosting + BreadcrumbList; draft emits neither.
- `/` WebSite, `/blog` Blog, Person enriched.
- lint + build + test green.
