# 0009 - Blog content pipeline + first post (plan)

Build plan for `docs/specs/0009-blog-content-pipeline.md`. Built on branch
`0009-blog-content-pipeline` in the primary checkout (not a separate `.worktrees/` dir): the
uncommitted spec + `AGENTS.md` edits and the scrubbed images already live here, and building in the
single-lockfile main checkout sidesteps the worktree `npm ci` / `outputFileTracingRoot` quirks
(learnings 0002, image-perf feedback 0006). Still ships as a reviewed PR, merged on approval.

## Decisions locked

- **MDX compiler:** `next-mdx-remote` (its `/rsc` server entry) - `compileMDX` renders the body in
  a Server Component against Next 16.2.9 / React 19. If it will not compile cleanly, fall back to
  `@mdx-js/mdx` `compile` + `run`. This is the one new runtime dependency.
- **Frontmatter:** hand-rolled tiny parser in the blog core (no `gray-matter` dep) - splits the
  leading `---` block and reads our known fields (`title`, `date`, `tags`, `excerpt`, `cover`), so
  the listing reads frontmatter cheaply without compiling every post's MDX. MDX is compiled only on
  the post page.
- **Slug:** `.mdx` basename. File named as the title lowercased + dash-separated.
- **Images:** static-imported for blur placeholders (learnings 0005). Cover `turing-sunrise.png`
  (pixel art - `image-rendering: pixelated`, dark mat, never blur-upscaled); body
  `zombie-horde-title.png` after the game-intro paragraph. Both already scrubbed + committed under
  `public/images/blog/`.
- **Content voice:** Canadian English (-ize, -our, -re; "recognize" not "recognise") and no long
  dashes ("Turing - a language", not "--"); straight quotes.

## Steps

1. **Deps.** Add `next-mdx-remote` to `package.json`; `npm install`. No `gray-matter`.
2. **Blog core + loader.** `src/lib/blog.js` (pure, `node --test`-able): `parseFrontmatter(raw)`,
   `slugify`, and file-reading `getAllPosts()` (newest-first) / `getPostBySlug(slug)` returning
   `{ slug, title, date, tags, excerpt, coverKey, body }`. `src/lib/blog.ts` re-exports typed
   wrappers if needed. Missing required field -> throw at build.
3. **Blog images registry.** `src/lib/blog-images.ts`: static-import the cover + inline images,
   keyed by filename with alt text (mirrors the `images` map in `site.ts`). Cover alt: "Pixel-art
   sunrise rendered in Turing, from the game Zombie Horde." Inline alt: "The chrome 'ZOMBIE HORDE'
   title graphic."
4. **MDX render component.** `src/components/post-body.tsx` (RSC): `compileMDX` with a component
   map - `img`/a custom `<PostImage>` -> `next/image` via the registry (blur), `a`/`h2`/`p`/`hr`
   -> token-styled elements. Prose styling from Harbor tokens (a scoped `.prose` block in
   `theme-harbor.css` or a component map), light/dark safe.
5. **Post content.** `content/blog/i-picked-the-wrong-elective.mdx` with frontmatter
   (`title`, `date: 2026-06-30`, `tags: [Life]`, `excerpt`, `cover: turing-sunrise.png`) and the
   Canadian-English, long-dash-free body; insert the `zombie-horde-title.png` image right after the
   "A few friends and I wrote a video game ... Zombie Horde" paragraph.
6. **`/blog` listing.** Replace the placeholder in `src/app/blog/page.tsx`: real list from
   `getAllPosts()` - cover thumbnail (pixelated mat for pixel covers), title, formatted date,
   excerpt, tag labels. Responsive, themed.
7. **`/blog/[slug]` page.** Replace the placeholder in `src/app/blog/[slug]/page.tsx`:
   `generateStaticParams` from the content dir, real `generateMetadata` (title, description from
   excerpt, per-post OG image), header (title/date/tags), cover, `<PostBody/>`, back link.
8. **Per-post OG image.** `src/app/blog/[slug]/opengraph-image.tsx`: model on
   `src/app/opengraph-image.tsx` (satori + `_og` woff). If the post has a `cover`, compose it
   centred on a dark 1200x630 canvas (pixel covers not stretched); else a branded title card. Smoke
   asserts `200 image/png`.
9. **Tests.** `tests/blog.test.mjs` (frontmatter parse, required-field failure, slugify,
   newest-first sort). Extend the route smoke: `/blog` contains the post title + excerpt and no
   "Placeholder"; `/blog/i-picked-the-wrong-elective` contains a body-unique phrase, renders the
   inline image (blur `data:` placeholder), and its `og:image` path returns `200 image/png`.
10. **Reflect.** Flip the `/blog` and `/blog/[slug]` rows in `docs/overview/features.md` to live;
    add an `architecture.md` line only if the MDX approach differs from what it already states.
    `AGENTS.md` blog carve-out is already in place.
11. **Verify.** `npm run lint`, `npm run build`, `npm test` all green. Manually confirm `/blog`,
    the post, and the OG image on `next build` output before commit (learnings 0004).

## Review (personas)

New runtime dep + new data-flow (file-system content -> RSC render) + observable behaviour change:
scope in **engineer**, **tester**, **architect**, **security** (dep provenance, that MDX only ever
compiles our own tracked files, no PII in the images/post). Post findings as inline PR comments;
roll blockers/majors into `docs/feedback/` + `overview/learnings.md`. Address, re-test, merge on
green + approval.

## Out (per spec)

Interactive tag filtering, Shiki syntax highlighting, home "latest posts" strip, comments,
RSS/pagination. Follow-ups.
