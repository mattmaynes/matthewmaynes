# Plan 0012 - Blog discovery: tag filter, search, "New" badge

Source spec: `docs/specs/0012-blog-discovery.md`.

## Design decisions (read before building)

- **Client island.** The listing page (`src/app/blog/page.tsx`) is a Server Component and stays one:
  it loads posts, resolves each cover, computes the `isNew` flag server-side, and passes a
  serializable array to a new `"use client"` island `src/components/blog-list.tsx` that owns the
  filter/search UI + state and renders the rows. Keep the existing row markup (cover thumb, title
  link, date, excerpt, tag pills) - move it into the island; do not restyle it.
- **Cover data crosses the boundary as plain props.** Resolve `getBlogImage(post.coverKey)` on the
  server and pass the `StaticImageData` (it carries `blurDataURL`) plus the `pixelated` flag per
  post, so `next/image` in the island keeps `placeholder="blur"` / pixelated behaviour (learnings
  0005). Do not import `blog-images.ts` into the client island.
- **"New" badge is computed on the SERVER and passed as a per-post `isNew: boolean`.** The page
  computes it once: the newest post (first after `sortPostsNewestFirst`) AND `isRecent(post.date,
  Date.now(), 30)`. Because the value is baked into the SSG HTML and the client renders it straight
  from the prop (no `Date.now()` on the client), there is no hydration mismatch. "New" therefore
  means "new as of the last build/deploy", which is correct for a site rebuilt each deploy.

## Steps

1. **Pure helpers in `src/lib/blog.js`** (unit-tested, injected clock - NO wall-clock in tests):
   - `isRecent(dateStr, nowMs, days)` -> boolean: true if `dateStr` (YYYY-MM-DD, parsed UTC like
     `formatPostDate`) is within `days` of `nowMs`. Test the boundary (exactly N days, just inside,
     just outside) with an injected `nowMs`.
   - Optionally `newPostSlug(posts, nowMs, days=30)` -> slug|null (newest post if recent), so the
     "which post is New" rule is pure and testable against a multi-post fixture. Export typed
     wrappers in `blog.ts` as needed (remember: same-basename `.js`/`.ts` means every new core export
     needs a matching `blog.ts` re-export or `tsc`/`next build` fails - see learnings 0011).
2. **`src/components/blog-icons.tsx`:** add a `SearchIcon` wrapper over `@rogueoak/icons` `Search`
   (same client-boundary pattern as `ClockIcon`).
3. **`src/components/blog-list.tsx`** (`"use client"`):
   - Props: `posts` (array of `{slug,title,excerpt,date,tags,cover,pixelated,isNew}`).
   - Tag state initialised from `?tag=` via `useSearchParams`; `router.replace` updates the URL on
     change with `{ scroll: false }`; unknown/absent = "All". Tag set = union of `posts[].tags`.
     Chips are `<button>`s with `aria-pressed`, matching the tag-pill styling but interactive; an
     "All" chip clears. Tag match is case-insensitive.
   - Search: a controlled `<input>` (with a visually-hidden `<label>` and the `SearchIcon`), filters
     by case-insensitive substring over `title + excerpt + tags.join(" ")`. Composes with the active
     tag (filter by tag first, then search).
   - Renders the filtered rows (the moved-over row markup). The newest post shows a "New" accent
     pill (warm gold Harbor accent, e.g. `bg-accent`/`text-accent` tokens - confirm the token names
     in `theme-harbor.css`) when `post.isNew`, distinct from the tag pills.
   - Empty state: when the filtered set is empty, show the dashed-border block (reuse the existing
     "No posts yet" styling) with match-aware copy ("No posts match ...").
   - Preserve focus-visible rings on all new controls (same ring tokens as the existing links).
4. **`src/app/blog/page.tsx`:** load posts, resolve covers, compute `isNew` per post server-side,
   render `<BlogList posts={...} />` inside the existing section wrapper (keep the `<h1>Blog</h1>` +
   intro paragraph). Wrap the island in `<Suspense>` if `useSearchParams` requires it for the build.
5. **Tests:**
   - `tests/blog.test.mjs`: unit-test `isRecent` (boundary cases, injected now) and `newPostSlug`
     (newest-and-recent vs newest-but-old vs empty) against a multi-post fixture. Assert non-mutation
     of the input array.
   - `tests/smoke.test.mjs`: assert the `/blog` HTML contains the durable controls - the search input
     (its placeholder/label text) and a tag-filter control (e.g. an "All" chip and a tag name). Do
     **NOT** assert the live "New" badge in the smoke test: it is date-relative to build time (the
     seed post is 2026-06-28, so the badge naturally disappears 30 days later) and would become a
     time-bomb. The badge is covered by the deterministic unit test instead.
6. **Verify (mirror CI exactly, in the worktree):** `npm ci`, then `npm run lint`,
   `npm run resume:pdf:check`, `npm run build`, `npm test`. All green before commit. (This PR does
   not touch `theme-harbor.css`, so the resume hash should be untouched - the check just confirms it.)
7. **Reflect:** update `docs/overview/features.md` (the `/blog` row + Blog section: tag filtering,
   search, New badge are now live; drop the "Tag filtering is a later spec" note) and
   `docs/overview/architecture.md` if the client-island seam is worth recording. Add a learning only
   if friction surfaced.

## Files touched

- `src/lib/blog.js`, `src/lib/blog.ts` (pure helpers + wrappers)
- `src/components/blog-icons.tsx` (SearchIcon), `src/components/blog-list.tsx` (new island)
- `src/app/blog/page.tsx` (render the island)
- `tests/blog.test.mjs`, `tests/smoke.test.mjs`
- `docs/overview/features.md` (+ maybe `architecture.md`)

## Verification checklist

- [ ] Tag chip filters the list; "All" clears; `?tag=` reflects + restores on load.
- [ ] Search narrows by title/excerpt/tags and composes with the active tag.
- [ ] No-match shows a clear empty message.
- [ ] Newest recent post shows a "New" badge; older posts never do (unit-tested with injected now).
- [ ] `isRecent`/`newPostSlug` unit tests pass with an injected clock (no wall-clock).
- [ ] Smoke asserts the durable search + tag controls (not the transient badge).
- [ ] lint + resume:pdf:check + build + test all green.
