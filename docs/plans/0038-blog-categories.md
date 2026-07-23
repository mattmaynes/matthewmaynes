# Plan 0038 - Blog categories

Implements spec `0038-blog-categories`. Built on branch `feat/blog-categories`.

## Steps

1. **View core (`src/lib/blog-view.ts`)** - add `CATEGORIES` (ordered const) + `Category` type +
   `isCategory`; `deriveCategories` (enum order, present-only, non-mutating); `categorySlug` /
   `categoryFromSlug` / `resolveActiveCategory` (mirror the tag helpers); extract `matchesQuery`
   and add `filterByCategory`; add `category` to `FilterablePost`/`PostRowData`.
2. **Loader (`src/lib/blog.ts`)** - add `category` to `Post`/`Frontmatter`; parse the key; add to
   `REQUIRED_FIELDS`; enum-validate via `isCategory` (loud build error); map it in `readPost`.
3. **Row mapper (`src/lib/post-summaries.ts`)** - pass `category` into `PostRowData`.
4. **Components** - category badge on `PostRow` and the post header (`post-article.tsx`, both the
   overlay/mobile `HeroMeta` and the no-cover header), linking to `/blog/categories/<slug>`.
5. **Listing filter (`src/components/blog-list.tsx`)** - replace the tag Combobox with a category
   chip row backed by `?category=`; filter via `filterByCategory`; keep the search box.
6. **Archive route** - `src/app/blog/categories/[slug]/page.tsx`, mirroring the tag archive.
7. **Sitemap** - add category archive URLs.
8. **Content migration** - assign a category to all nine posts (mapping in the spec/PR).
9. **Fixtures** - add `category` to the two draft/scheduled fixtures and the `GOOD` test fixture.
10. **Tests** - unit (parse/validate/enum, derive/slug/resolve/`filterByCategory`) + smoke
    (archive 200 + unique title + 404, badge link, chips render).
11. **Reflect** - update `docs/overview/features.md` + `architecture.md`; note 0038 supersedes the
    tag-filter portion of spec 0012.

## Verification

`npm run lint`, `npm test`, `npm run build` green; screenshots of `/blog` (chips), a filtered
view, a post header badge, and a category archive attached to the PR. Hold for review before merge.
