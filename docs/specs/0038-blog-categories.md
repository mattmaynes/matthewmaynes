# 0038 - Blog categories: one theme per post, category-driven filtering

## Problem

Blog posts carry free-form `tags` (three per post, author's choice). Tags are great for
keyword search and SEO-oriented per-tag archives, but they are a poor *filter*: across nine
posts there are already 24 distinct tags, almost all singletons, so the `/blog` tag filter is
a long list of one-post entries and gives a visitor no clean sense of what a post is *about*.
Tags answer "what keywords appear here"; they do not answer "what theme is this".

We want a single, controlled **category** per post - a small fixed set of themes - and to make
the `/blog` filter operate on that, so filtering is meaningful and it is obvious at a glance
which theme a post falls under. Tags stay exactly as they are for keyword search and the
existing `/blog/tags/*` archives.

For: a visitor scanning `/blog` who wants to narrow to a theme (e.g. "Leadership") rather than
wade through a noisy tag list, and who should be able to tell a post's theme from its row.

## Outcome

Observable when done:

1. Every post declares exactly one `category` in its frontmatter, drawn from a **fixed enum**:
   `Engineering`, `Leadership`, `Career`, `AI`, `Projects`, `Life`. A missing category, or one
   outside the enum, **fails the build loudly** (same guarantee `tags`/`title` already have), so
   the taxonomy cannot drift the way tags did.
2. The `/blog` listing filter is a **row of category chips** (an "All posts" chip plus one per
   category that has posts) instead of the tag dropdown. Selecting a chip filters the list and is
   reflected in the URL (`?category=`), so a filtered view is shareable/bookmarkable. The search
   box is unchanged and still matches title + excerpt + **tags**.
3. Each post row and the post header show a **category badge**, visually distinct from the tag
   pills, so the theme reads at a glance. The badge links to that category's archive.
4. **Category archive pages** exist at `/blog/categories/<slug>` (one per category with posts,
   baked at build, indexable, in the sitemap), mirroring the existing tag archives.
5. Tags are otherwise untouched: still shown on rows and post headers, still link to
   `/blog/tags/*`, still searchable, still in the sitemap and OG card.

## Scope

**In:**
- A `category: <enum>` frontmatter field: parsed and enum-validated in `blog.ts`; `category`
  added to `Post`/`Frontmatter` and to `REQUIRED_FIELDS`.
- The `CATEGORIES` ordered constant + `Category` type + `isCategory`, `deriveCategories`,
  `categorySlug`, `categoryFromSlug`, `resolveActiveCategory`, and a `filterByCategory` helper
  in the fs-free `blog-view` core (unit-tested), reusing a shared query matcher with `filterPosts`.
- Swap the `/blog` tag Combobox for category chips (URL-backed `?category=`, "All posts" default).
- A category badge on `PostRow` and the post header (`post-article.tsx`), linking to the archive.
- `/blog/categories/[slug]/page.tsx`, mirroring `/blog/tags/[tag]/page.tsx`.
- Category archive URLs in `sitemap.ts`.
- Assign a category to all nine existing posts (content migration).
- Unit tests (parse/validate/enum, derive/slug/resolve/filter) and smoke tests (archive page,
  badge link, chips render).

**Out:**
- No change to `tags`: the `/blog/tags/*` archives, tag pills, tag search, tag sitemap entries,
  and the OG card's tag display all stay.
- No multi-category posts (exactly one per post - that is the whole point).
- No category on the RSS feed items (the feed carries no taxonomy today; unchanged).
- No new dependency; chips reuse existing tokens/utilities, not a new component.
- No redirect infrastructure - this ships with the category set fixed; renaming a category later
  is a separate change.

## Approach

**Taxonomy as a fixed enum.** `CATEGORIES = ["Engineering", "Leadership", "Career", "AI",
"Projects", "Life"] as const` lives in `blog-view.ts` (fs-free, so both the server page and the
client island import it), with a `Category` type and `isCategory`. Array order is the canonical
chip/sitemap order. `blog.ts` already imports from `blog-view.ts` (`slugify`, `formatPostDate`),
so its frontmatter validator imports `isCategory` and throws a build error naming the allowed
values when a post's category is missing or unknown - the same loud-failure contract as the
existing `slug !== slugify(title)` guard.

**Filtering.** `filterPosts(posts, activeTag, query)` stays (tag membership) for the tag archives.
A new `filterByCategory(posts, activeCategory, query)` filters by the single `post.category`
(case-insensitive exact match) then the same query; both share a private `matchesQuery` so the
title+excerpt+tags search logic is defined once. `deriveCategories(posts)` returns the enum
filtered to categories that actually have posts, in `CATEGORIES` order (stable chips, no empty
themes). `categorySlug`/`categoryFromSlug`/`resolveActiveCategory` mirror their tag counterparts.

**Chips, not a dropdown.** With only six fixed themes, a chip row makes every theme visible in one
glance and one tap to filter - the point of the feature. The island keeps its URL-as-source-of-
truth pattern (the `useSyncExternalStore` over `?category=`, same as the old `?tag=`), so the
filtered view stays shareable and the statically-generated list stays in the SSG HTML. The active
chip is filled; the rest are outlined. Exact chip treatment is a verify-in-browser call.

**Badge.** `PostRowData` and `ArticlePost` gain `category`. `PostRow` renders a category badge in
the title row (distinct from the accent series pill and the muted tag pills - a primary-tinted
chip) linking to `/blog/categories/<slug>`; the post header does the same. Tag pills render
unchanged beneath.

**Analytics + typing (review follow-ups).** The chip filter fires a PII-free
`blog_category_filtered` event (`{ category }`, the fixed enum or `"all"`), gated by
`clientAnalyticsEnabled()` like the subscribe/contact events - the raw `history.replaceState`
is invisible to the `$pageview` tracker, so this is the only way to see which themes readers
narrow to. The `category` field is typed as the `Category` union (not a bare `string`) on
`Post`/`Frontmatter`/`PostRowData`/`ArticlePost`, so the loader's `isCategory` guard buys
compile-time exhaustiveness downstream.

**Archive pages.** `/blog/categories/[slug]/page.tsx` is a near-copy of the tag archive:
`generateStaticParams` over `deriveCategories(getPublishedPosts())`, `dynamicParams = false`,
`revalidate = 60`, a route-unique `<title>` ("Posts in \"<Category>\" - Blog"), `filterByCategory`
for the rows, and the same subscribe footer.

## Acceptance

- [ ] A post missing `category`, or with a value outside the enum, fails `npm run build` with a
      message naming the allowed categories.
- [ ] All nine existing posts carry a valid category; `/blog` shows category chips ("All posts" +
      the categories present), and selecting one filters the list and sets `?category=`.
- [ ] The search box still filters by title/excerpt/tags and composes with the active category.
- [ ] Each post row and post header shows a category badge distinct from the tag pills, linking to
      `/blog/categories/<slug>`.
- [ ] `/blog/categories/<slug>` returns 200 with a route-unique title; an unknown slug 404s; the
      sitemap lists every category archive.
- [ ] Tags are unchanged: tag pills, `/blog/tags/*`, tag search, and tag sitemap entries all still
      work.
- [ ] `npm run lint`, `npm test`, and `npm run build` are green.
