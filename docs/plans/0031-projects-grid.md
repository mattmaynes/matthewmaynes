# 0031 - Projects grid - implementation plan

Plan for spec `docs/specs/0031-projects-grid.md` (Phase 1: the grid). Built in the worktree
`projects-grid-0031`, tested (lint + `node --test` + smoke) before commit.

## Content pipeline (feature)

- **`src/lib/projects-view.ts`** (pure, fs-free): `CATEGORIES` (the fixed Work -> Tinkering ->
  Making order + labels), `ProjectCategory`, `isProjectCategory`, the `Project` type, `sortByOrder`
  (ascending `order`, unset last, tie by title, non-mutating), `groupByCategory` (fixed order,
  drops empty sections). Re-exports `slugify` from `blog-view.ts` so one slugifier serves both.
- **`src/lib/projects.ts`** (fs loader, mirrors `blog.ts`): hand-parsed frontmatter,
  `parseProjectFrontmatter` (required: title/category/tagline; validates the category; parses tags
  array, numeric `order`, boolean `featured`), `readProject` (enforces filename === `slugify(title)`),
  `getAllProjects`. Reads only tracked files under `content/projects/`.
- **`src/lib/project-images.ts`** (registry, mirrors `blog-images.ts`): raster covers static-imported
  (blur + optimized, `object-cover`); the four first-party rogueoak logo SVGs referenced by public
  path, rendered `unoptimized` + `object-contain` on a neutral panel (no `dangerouslyAllowSVG`
  needed, no blur). `getProjectImage(key)` resolves a cover, undefined for absent/unknown.
- **`src/components/project-card.tsx`** (presentational, hook-free): Canopy `Card` + `Badge`; cover
  respects `fit`; `href` makes the whole card an external link (new tab, arrow affordance, sr-only
  "(opens in a new tab)"), otherwise a plain card.
- **`src/app/projects/page.tsx`** (Server Component): groups + renders the three sections; static
  in the SSG HTML. **`nav-icons.tsx`**: `ProjectsIcon` (Star) + `ExternalLinkIcon`.
- **`src/app/page.tsx`**: Projects card added to the "Around the site" grid (after Resume).
  **`site.ts`**: `/projects` relisted in `nav` (returns it to the header + sitemap).
- **`AGENTS.md`** (= CLAUDE.md): "Project content - lightweight process" carve-out added.

## Content (carve-out, ships with the feature PR)

13 seeded projects: Work (Rise, KX Insights Stream Processor, Analyst Table Transformer, Eagle
SNAP), Tinkering (rogueoak.com, matthewmaynes.com, Canopy, Trellis, Spectra), Making (Kitchen
Renovation, Multi-Level Deck, Front Deck, Back Deck). Covers under `public/images/projects/`.
Social Starter, Tree Planting, and Butterfly Garden are deferred (no photos yet).

## Decisions / notes

- **Manual `order`** (not date) drives within-section order - a curated showcase. Making order is
  provisional pending the author's chronology once all Making items exist.
- **Photo covers were EXIF-scrubbed** (`exiftool -all=`) before commit - one carried GPS home
  coordinates - and recompressed (`sips` q68 @ 1280px; `pngquant`): 4.9M -> 2.7M. Titles are
  town-free per the public-repo rule.
- **Work taglines/tags are drafts** derived from the images/names; the author confirms wording.
  Social Starter is image-pending (renders coverless) - the ship gate holds merge until it has one.
- Tests: `tests/projects.test.ts` (view helpers + parser + a pass over the real content); smoke
  asserts the three sections + real cards on `/projects`, the home Projects card, and `/projects`
  in the sitemap. Full suite: 130 pass.

## Worktree build note

Turbopack rejects a `node_modules` symlink that leaves the worktree root; the worktree needs a real
`node_modules` (a `cp -al` hardlink clone of the parent's is enough, offline). `outputFileTracingRoot`
is already pinned to the worktree, so the standalone build/smoke work from here.
