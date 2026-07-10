# 0031 - Projects grid (three curated sections of project cards)

## Problem

`/projects` is a `PagePlaceholder` stub ("Coming soon: a showcase of the things I've
built and shipped.") and is omitted from `nav` (so it is off the header and out of the
sitemap). The site tells the "who is this" story through About, Resume, and the Blog, but
has nowhere to show *the things Matthew has actually made* - the professional systems, the
open-source tooling, and the physical builds. A visitor curious about the work behind the
titles has to infer it from a resume bullet.

We want to restore `/projects` as a real, browsable showcase: a scannable grid of project
cards, grouped into three curated sections, each card a preview image + a one-line tagline.
An earlier version of this page existed (a two-card Canopy `Card` grid with the "Eagle SNAP"
demo) and was stubbed back in PR #33 with the note that "a grid of real projects with tech
stacks and write-ups is coming." This is that grid.

For: a visitor (recruiter, peer, or curious reader) who wants to see what Matthew builds,
across his professional work, his technical side projects, and his hands-on physical builds.

This spec covers **Phase 1 - the grid only**. Individual project story pages
(`/projects/[slug]` with a hero, a narrative, a gallery, and cross-links to related posts
and projects) are a deliberate follow-on (see Out), because a card does not need a detail
page to be useful: it can link straight out to a live site or repo, or simply stand as a
captioned card until it earns a write-up.

## Outcome

Observable when done:

1. `GET /projects` renders a page with **three labelled sections in a fixed order -
   Work, then Tinkering, then Making** - each a heading followed by a responsive grid of
   project cards. The order is professional-to-personal and does not depend on content.
2. Each **card** shows: a preview image (cover), the project title, a one-line tagline, and
   its tag badges. Cards are **uniform** - the same layout in every section, so the images
   themselves (not a per-section treatment) carry the difference.
3. A card **links out** when the project has an external URL (`href`): the whole card is a
   link to that URL, opens in a new tab, and shows a small "external link" affordance (an
   arrow glyph) plus an accessible "(opens in a new tab)" hint. A card with **no** `href` and
   no detail page (Phase 1) renders as a non-interactive card, ready to become an internal
   link in Phase 2.
4. Within each section, cards are ordered by a **manual `order` field (ascending, lowest at
   the top)** so the section is a *curated* showcase, not a date feed; the author places the
   newest/most-important project first. Ties break by title, alphabetically, for a stable build.
5. A section with **no** projects does not render (no empty heading); the three categories all
   exist in the model from day one regardless.
6. `/projects` is back in the site: relisted in `nav` (so it returns to the header and the
   sitemap), with a page `<title>`/description of its own.
7. The home page's "Around the site" cards gain a **Projects** card - an icon + title + a
   one-line note linking to `/projects` - beside About / Resume / Blog / Contact (the grid is
   already `lg:grid-cols-3`, so a fifth card fits with no layout change).
8. Adding a new project is **content, not a feature**: dropping a new
   `content/projects/<slug>.mdx` file (plus its cover image) makes a new card appear on the
   next build, with no code change. `CLAUDE.md` documents this carve-out (mirroring the blog one).

## Scope

**In:**

- **Content model + loader.** A new `content/projects/` directory of `.mdx` files, one per
  project, with a typed frontmatter schema (below). A `src/lib/projects.ts` filesystem loader
  mirroring `src/lib/blog.ts`: hand-parsed frontmatter (no new dep), reads only our own tracked
  files, fails the build loudly on a missing required field, an unknown `category`, or a
  filename/slug that does not match `slugify(title)`.
- **Pure view helpers (fs-free).** A `src/lib/projects-view.ts` for the grouping/sorting logic
  (`groupByCategory`, `sortByOrder`, the ordered category list + display labels), so it is
  `node --test`-importable without `node:fs` - the same split as `blog.ts` / `blog-view.ts`.
- **Project image registry.** A `src/lib/project-images.ts` keyed by filename with alt text and
  a per-image `fit` (`"cover"` for photos, `"contain"` for logos on a neutral surface) and an
  `unoptimized` flag for first-party SVG logos, mirroring `src/lib/blog-images.ts` (static
  imports -> real dimensions + `blurDataURL`). Covers live under `public/images/projects/`.
- **Listing page.** `src/app/projects/page.tsx` becomes a Server Component (replacing the
  placeholder) that loads projects, groups them by category, and renders the three ordered
  sections. No client island is needed (Phase 1 has no interactive filter), so the whole page
  is static in the SSG HTML.
- **Card component.** A presentational, hook-free `src/components/project-card.tsx` built on the
  Canopy `Card` + `Badge` primitives (via `@/components/ui`), rendering cover (with the right
  `fit`), title, tagline, tags, and the external-link affordance. One card markup, every section.
- **Home-page Projects card + icon.** Add a `Projects` entry to the home "Around the site" grid
  in `src/app/page.tsx` and a `ProjectsIcon` to `src/components/nav-icons.tsx` (wrapping an
  appropriate `@rogueoak/icons` glyph, e.g. a folder/grid/build icon), matching the existing
  card pattern.
- **Nav restoration.** Re-add `{ href: "/projects", label: "Projects" }` to `nav` in
  `src/lib/site.ts` (between Resume and Blog) and drop the "intentionally omitted" comment; this
  also returns `/projects` to the sitemap automatically.
- **Content carve-out.** Add a "Project content - lightweight process" section to `CLAUDE.md`
  mirroring the blog carve-out: a new `content/projects/*.mdx` entry is content (spell-checked
  Canadian English, no PII, public-only, location no finer than region, ships via an approved
  PR), and skips the full Spectra protocol - while the **pipeline/tooling** (`src/lib`,
  `src/components`, config) stays a full feature.
- **Ship gate.** The feature does **not** merge until every seeded card has both a **tagline**
  (description) and a **cover image**. Social Starter has no image yet, so it stays image-pending
  and blocks the ship until one is supplied (or it is explicitly deferred out of the seed set).
- **Seed content** for the three sections (see Appendix), created as content files under the
  carve-out. Making titles are town-free per the public-repo rule.
- **Tests.** Unit tests (`node --test`) for the pure view helpers (grouping keeps category
  order, empty categories drop out, `sortByOrder` is ascending + title-tiebroken + stable). A
  smoke assertion that `/projects` renders the three section headings and a route-unique project
  title, and that the home page shows the Projects card linking to `/projects`. `npm run lint`,
  `npm test`, `npm run build` green.

**Out:**

- **Phase 2 - project detail pages.** `/projects/[slug]` with a hero, an MDX story body,
  an image gallery (this is where Rise's before/after pair and any extra shots live), tag
  badges, and "related posts / related projects" cross-links. This is the next spec; Phase 1
  ships the grid and links out (or stands as a plain card) until then. The frontmatter reserves
  the fields Phase 2 will need (`href` optional now; a body may already be authored in the file
  and is simply not rendered yet), so Phase 2 is additive.
- **Filtering / search on `/projects`.** The three fixed sections are the structure; there is no
  tag-filter Combobox here (unlike `/blog`). Tags are display badges for now. If the grid grows
  enough to want cross-cutting filtering, that is its own spec.
- **A "latest project" highlight on the home page** (a row-style highlight paralleling spec
  0029's latest-post section). The home *nav card* for Projects is in scope (Outcome 7); a
  dynamic latest-project highlight is a possible later touch, not this spec.
- **Per-project Open Graph cards** and per-project routes in the sitemap (both arrive with
  Phase 2's detail pages). The listing inherits the site-level `opengraph-image`.
- **Any new dependency or design-system change.** Reuses Canopy `Card`/`Badge` and Harbor tokens.

## Approach

**Content model.** One `.mdx` file per project under `content/projects/`, slug = filename
basename, enforced to equal `slugify(title)` exactly as `blog.ts` does. Frontmatter:

```yaml
title: Eagle SNAP                       # required
category: work                          # required: work | tinkering | making
tagline: Field data capture for utility crews   # required: the card one-liner
cover: eagle-snap.png                   # optional: a key into project-images.ts
tags: [TypeScript, React, Offline-first]  # optional: display badges (free-form)
order: 5                                 # optional: ascending, lowest at the top of its section
href: https://example.com                # optional: external link; omit once a detail page exists
featured: false                          # optional, reserved for Phase 2 emphasis
```

The MDX body (the project story) may be authored now but is **not rendered in Phase 1** - the
listing reads frontmatter only, cheaply, like the blog listing. `category` is validated against
the three known values and the build throws on anything else (loud failure, same posture as the
blog required-field check). `order` is optional: unset sorts to the bottom of its section
(treated as `+Infinity`), so a file with no `order` still renders - it just is not curated to the
top.

**Grouping + ordering (pure, fs-free in `projects-view.ts`).** The category order and display
labels are a single ordered constant:

```ts
export const CATEGORIES = [
  { key: "work",      label: "Work" },
  { key: "tinkering", label: "Tinkering" },
  { key: "making",    label: "Making" },
] as const;
```

`groupByCategory(projects)` returns the sections in that fixed order, each with its label and its
projects already run through `sortByOrder` (ascending `order`, ties by `title` alphabetical, a
stable non-mutating sort). A section whose project list is empty is dropped by the page before
render (no empty heading). Keeping this logic fs-free lets `node --test` cover it against a
fixture without a real content dir (the same reason `deriveTags`/`filterPosts` live in
`blog-view.ts`) and keeps the Server page a thin renderer.

**Listing page (Server Component).** `src/app/projects/page.tsx` calls `getAllProjects()` and
`groupByCategory(...)`, then renders each non-empty section as an `<h2>` + a responsive card grid
(`grid gap-6 sm:grid-cols-2 lg:grid-cols-3`, echoing the old `grid gap-6 sm:grid-cols-2` but with
a third column at `lg`). Static - no `use client`, no `useSearchParams`, fully in the SSG HTML.
A short intro line sits above the sections; `metadata` sets a `Projects` title and a description.

**Card component.** `src/components/project-card.tsx` is presentational and hook-free (so it could
be reused by a Server detail page later, the way `PostRow` is shared). It wraps the Canopy `Card`:
a cover `Image` on top (`placeholder="blur"`, `sizes` responsive, `aspect-[16/10]` like the blog
thumbnail), then `CardHeader`/`CardTitle` with the title, the tagline as body text, and the tags
as a row of Canopy `Badge`s. Cover rendering respects the image's `fit`: photos `object-cover`,
logos `object-contain` centred on a neutral `surface` (so a wordmark is not stretched); a card
with no cover renders no image block and still lays out. Link behaviour:

- `href` present -> the card title (and cover) link to `href` with
  `target="_blank" rel="noopener noreferrer"`, an inline arrow external-link glyph after the
  title, and an `sr-only` "(opens in a new tab)".
- no `href` (Phase 1, no detail page yet) -> the card is a plain, non-interactive card. In Phase 2
  the same absence resolves to an internal `/projects/<slug>` link; the card takes a resolved
  `href` + an `external` boolean so the link target is decided by the page, not the card.

**Images.** Covers are static-imported through `src/lib/project-images.ts` (keyed by filename +
alt text + `fit` + `unoptimized`), like `blog-images.ts`. Photos optimize as usual; the four
first-party rogueoak logo SVGs render `unoptimized` (bypassing the image optimizer, so no
`dangerouslyAllowSVG` config is needed) with `object-contain`. The loader stores only the `cover`
filename key; the page resolves it to the staged image, so a missing/unknown key is a caught,
explainable gap rather than a broken import.

**Home-page card + icon.** Add `{ href: "/projects", title: "Projects", note: "...", Icon:
ProjectsIcon }` to the `Around the site` array in `src/app/page.tsx` (placed to mirror the nav
order: after Resume), and a `ProjectsIcon` wrapper in `nav-icons.tsx` over an apt `@rogueoak/icons`
glyph, `aria-hidden` like its siblings. Pure markup reuse - no new pattern.

**Nav + sitemap.** Re-add the `/projects` entry to `nav` in `site.ts`; the header and
`sitemap.ts` both derive from `nav`, so this relists the page in both. Remove the now-stale
"intentionally omitted while it is an in-progress stub" comment.

**Content carve-out (`CLAUDE.md`).** Add a section mirroring "Blog posts - lightweight process":
authoring a **project** (content under `content/projects/`) is content, not a feature - no spec,
no plan, no persona review - but it still must be spell-checked in Canadian English, follow the
repo writing rules, keep the public-repo rule (no PII; location no finer than region), stay prose
plus the known components only, and ship via an approved PR. The **pipeline and tooling** stays a
full-Spectra feature.

## Acceptance

- [ ] `GET /projects` renders three sections in the fixed order Work -> Tinkering -> Making, each
      a heading + a responsive grid of uniform cards; the placeholder is gone.
- [ ] A card shows cover, title, tagline, and tag badges; a photo cover renders `object-cover` and
      a logo cover renders `object-contain` (not stretched); a card with no cover still lays out.
- [ ] A project with `href` makes the card link to that URL in a new tab, with an external
      affordance and an `sr-only` "(opens in a new tab)"; a project without `href` is non-interactive.
- [ ] Cards within a section are ordered by ascending `order` (lowest at top), ties broken by
      title; a project with no `order` sorts to the bottom of its section rather than disappearing.
- [ ] A category with no projects renders no heading and no empty grid.
- [ ] The loader fails the build loudly on a missing required field (`title`/`category`/`tagline`),
      an unknown `category`, or a filename that does not equal `slugify(title)`.
- [ ] `/projects` is back in `nav` (header + sitemap); the "intentionally omitted" comment is gone.
- [ ] The home page's "Around the site" grid shows a Projects card (icon + title + note) linking
      to `/projects`.
- [ ] The pure `projects-view` helpers have `node --test` coverage: category order preserved, empty
      categories dropped, `sortByOrder` ascending + title-tiebroken + non-mutating.
- [ ] The `/projects` smoke test asserts the three section headings and a route-unique project
      title; the `/` smoke asserts the Projects card links to `/projects`.
- [ ] `CLAUDE.md` documents the project-content carve-out (content vs pipeline), mirroring the blog
      rule; the seeded Making titles name no town (public-repo rule).
- [ ] Ship gate: every seeded card has a tagline and a cover image before merge (Social Starter,
      Tree Planting, and Butterfly Garden are held out of the seed set until they have images).
- [ ] `npm run lint`, `npm test`, and `npm run build` are green.

## Appendix - seed content (newest at top of each section)

Created as content files under the carve-out (not part of the pipeline change). Ordering below is
the intended top-to-bottom `order` within each section; final taglines are authored with the content.

**Work**

| # | Title | Cover | Link |
|---|-------|-------|------|
| 1 | Rise | `rise.webp` (before/after -> Phase 2 gallery) | https://constantcontact.com |
| 2 | KX Insights Stream Processor | `kx-insights-stream-processor.png` | - |
| 3 | Analyst Table Transformer | `analyst-table-transformer.png` | - |
| 4 | Eagle SNAP | `eagle-snap.png` (already in repo) | - |

**Tinkering** (artwork from `../.github/profile/assets/`)

| # | Title | Cover |
|---|-------|-------|
| 1 | rogueoak.com | `rogueoak-logo.svg` (or `rogueoak-avatar.png`) |
| 2 | matthewmaynes.com | profile avatar (`public/images/headshot.jpg`) |
| 3 | Canopy | `canopy-logo.svg` |
| 4 | Trellis | `trellis-logo.svg` |
| 5 | Spectra | `spectra-logo.svg` |

**Making** (titles are town-free per the public-repo rule; final wording set with the content)

| # | Title | Cover |
|---|-------|-------|
| 1 | Kitchen Renovation | `kitchen-renovation.jpg` |
| 2 | Multi-Level Deck | `multi-level-deck.jpg` |
| 3 | Front Deck | `front-deck.jpg` |
| 4 | Back Deck | `back-deck.jpg` |

**Deferred** (no image yet, held out of the seed): Social Starter (link https://ctct.social),
Tree Planting, Butterfly Garden. Each drops in as content once its photo arrives.

Note: photo covers were EXIF-scrubbed (`exiftool -all=`, GPS removed) and recompressed before
commit. Making order above is provisional pending the author's chronology; Work taglines/tags are
drafts pending the author's confirmation.
