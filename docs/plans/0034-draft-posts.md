# Plan 0034 - Draft blog posts

Build plan for spec `0034-draft-posts`. Ordered so the pure seam + tests land before the routes that
consume them.

## Step 1 - `draft` flag + pure seams (`src/lib/blog.ts`)

- Add `draft?: boolean` to `Frontmatter` (after `coverCaption`) and `Post`.
- `parseFrontmatter`: recognise `draft`, store `data.draft = value === "true"` (kept out of the
  string branch; not a required field).
- `readPost`: set `draft: data.draft === true` on the returned `Post`.
- Add `getPublishedPosts()` = `getAllPosts().filter(p => !p.draft)` and `getDraftPosts()` =
  `getAllPosts().filter(p => p.draft)`. `getAllPosts()` unchanged.
- **Verify:** `tests/blog.test.ts` - a mixed fixture (>= 2 published + >= 1 draft) proves
  `getPublishedPosts` excludes drafts and keeps newest-first, `getDraftPosts` returns only drafts, and
  `parseFrontmatter` reads `draft: true` / defaults absent to `false`.

## Step 2 - Thread `basePath` through the row UI

- `src/lib/post-summaries.ts` `toPostRows(posts, newSlug, basePath = "/blog")`: put `basePath` (or the
  full href) onto each `PostRowData`.
- `src/lib/blog-view.ts` `PostRowData`: add the href/basePath field.
- `src/components/post-row.tsx` + `src/components/post-nav.tsx`: link to the row's href instead of a
  hard-coded `/blog/<slug>`.
- **Verify:** existing listing/tag smoke still green (published rows still link `/blog/<slug>`).

## Step 3 - Extract the shared post article (`src/components/post-article.tsx`)

- Move the body of `src/app/blog/[slug]/page.tsx` (breadcrumbs, hero/cover + `HeroMeta`, `PostBody`,
  `PostNav`, subscribe CTA) into a Server Component `PostArticle({ post, previous, next, minutes,
  isDraft, basePath })`.
- Breadcrumb + nav hrefs derive from `basePath`. `isDraft` renders a "Draft" pill in the hero overlay,
  the mobile header, and the no-cover header.
- `[slug]/page.tsx` becomes a thin shell: resolve via `getPostBySlug`; `notFound()` if missing or
  `post.draft`; adjacency over `getPublishedPosts()`; render `PostArticle` with `basePath="/blog"`.

## Step 4 - Public surfaces -> `getPublishedPosts()`

Swap `getAllPosts()` -> `getPublishedPosts()` at:
- `src/app/blog/page.tsx` (list + `newPostSlug` + tags)
- `src/app/page.tsx` (home latest)
- `src/app/subscribe/page.tsx` (latest preview)
- `src/app/blog/feed.xml/route.ts` (feed)
- `src/app/sitemap.ts` (post + tag entries)
- `src/app/blog/tags/[tag]/page.tsx` (`generateStaticParams`, `generateMetadata`, render)
- `src/app/blog/[slug]/page.tsx` `generateStaticParams`
- `src/app/blog/[slug]/opengraph-image.tsx` `generateStaticParams`

## Step 5 - Draft routes

- `src/app/blog/drafts/page.tsx`: index over `getDraftPosts()` -> `toPostRows(..., "/blog/drafts")` ->
  `BlogList`; `metadata.robots = { index: false, follow: false }`; empty state reused.
- `src/app/blog/drafts/[slug]/page.tsx`: `generateStaticParams` over `getDraftPosts()`;
  `generateMetadata` `noindex`; shell resolves via `getPostBySlug`, `notFound()` if missing or not a
  draft; adjacency over `getDraftPosts()`; render `PostArticle` `isDraft basePath="/blog/drafts"`.

## Step 6 - Mark the car post a draft

- Add `draft: true` to `content/blog/the-car-that-taught-me-how-to-decide.mdx` frontmatter.

## Step 7 - Tests + smoke markers

- Feed test (`tests/rss.test.ts`): a draft is excluded from the built feed.
- Smoke (`tests/*smoke*`): `/blog/drafts` 200 + draft title + `noindex`; `/blog/drafts/<slug>` 200 +
  body + "Draft" marker + `noindex`; `/blog` and feed exclude the draft title; `/blog/<draftslug>`
  404; `/blog/drafts/<publishedslug>` 404. Use markers unique to the unit (learnings 0001/0018).

## Step 8 - Verify + reflect

- `npm run lint` && `npm test` && `npm run build` green (in the worktree; `node_modules` hardlinked).
- Update `docs/overview/features.md` (new capability) and `docs/overview/architecture.md` (the
  `/blog/drafts` routes + published/draft seam) in the same PR. `learnings.md` only if review surfaces
  a general lesson.
