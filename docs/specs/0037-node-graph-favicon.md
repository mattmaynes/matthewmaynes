# 0037 - Node-graph "M" favicon

## Problem

The site's brand mark is a skeuomorphic brushed-metal serif "M" (`public/brand/logo-m.png`),
a 2010s iOS aesthetic that is dated and clashes with the flat, modern Harbor design system.
It is the master the whole favicon / app-icon set is generated from (spec via
`scripts/build-icons.ts`), so it shows up in every browser tab, the iOS home-screen tile, and
the PWA install icon.

## Outcome

- The mark is redrawn in the rogueoak "constellation" style (see `../rogueoak/src/app/icon.svg`):
  a glowing node-graph on a dark, full-bleed background, but coloured in the site's own Harbor
  palette (blue ramp + slate/white) rather than rogueoak's greens.
- The letter "M" is formed by graph edges and circular nodes, with a single warm gold accent
  node at the central valley (the one warm note the brand already uses in its announcement
  emails).
- A vector source of truth now exists (`public/brand/logo-m.svg`); the raster master and the
  full icon set are regenerated from it, unchanged pipeline otherwise.
- The vector is also shipped as the favicon itself (`src/app/icon.svg`), so the mark stays sharp
  at whatever size a tab, bookmark bar, or history row asks for, on any display density. The
  rasters remain as fallbacks for clients without SVG-favicon support.
- Nothing else changes: the header brand is a text wordmark and the OG cards / emails use the
  headshot, so the "M" only surfaces as the favicon/app-icon set.

## Scope

**In**

- Add `public/brand/logo-m.svg` - the vector mark (512 viewBox, full-bleed Harbor-dark
  background, blue node-graph "M", gold accent node).
- Replace `public/brand/logo-m.png` with a 1024x1024 full-bleed master rendered from the SVG.
- Regenerate the derived set via `npm run icons`: `src/app/icon.svg` (a copy of the
  vector source), `src/app/icon.png` (512), `src/app/apple-icon.png` (180), `public/icon-192.png`,
  `public/icon-512.png`, and `src/app/favicon.ico` (16/32/48).
- Fold the `qlmanage` render of the 1024 raster master into `build-icons.ts` so the SVG is the
  single source of truth and no manual step can leave the rasters disagreeing with the vector.
- Guard the mark's inertness before it is copied: the vector favicon is served from the site
  origin, so the build refuses a source carrying script, external references, or event handlers.
- Add `npm run icons:check` (a byte compare, no macOS tooling) to `verify.yml`, so an edited
  vector that was never regenerated fails CI instead of shipping a stale favicon.

**Out**

- The manifest theme/background colour (`#14222f`) is unchanged - it already sits well with the
  new dark icon.
- No new build dependency: rendering the SVG master uses macOS `qlmanage` (Quick Look), matching
  the pipeline's existing macOS-only, `sips`-based, dependency-free approach.

## Approach

The mark is defined once as an SVG, and everything else is derived from it in one command.
`build-icons.ts` renders the 1024 raster master with Quick Look (`qlmanage`), fans it out to every
size with `sips`, packs the multi-res `.ico` with Node stdlib, and copies the SVG itself to
`src/app/icon.svg` as the vector favicon. Editing the mark is therefore: edit the SVG, run
`npm run icons`.

Two guards keep that invariant honest. The vector favicon is served from the site origin, so the
build asserts the source is inert (plain shapes only) before copying it - a document with script or
external references would otherwise ship as first-party content. And because the full build needs
macOS-only tooling it can never run in CI, `npm run icons:check` does a pure byte compare of
`src/app/icon.svg` against the source, wired into `verify.yml` alongside the existing
`resume:pdf:check` / `privacy:check` freshness gates.

## Acceptance

- All seven icon assets regenerate at their expected dimensions; `favicon.ico` carries 16/32/48
  frames and `src/app/icon.svg` matches the vector source byte for byte.
- `npm run icons` is idempotent: a second run leaves every committed asset byte-identical.
- `npm run icons:check` passes when in sync, and exits non-zero with an actionable message when
  `src/app/icon.svg` has drifted or is missing.
- The build refuses a source SVG carrying script, external references, or event handlers, and
  writes nothing when it does.
- The rendered page links the vector favicon:
  `<link rel="icon" href="/icon.svg" sizes="any" type="image/svg+xml">`, with the `.ico` and
  512 px `.png` still linked as fallbacks - asserted by the smoke suite, which fetches every
  linked icon and requires the `image/svg+xml` link specifically.
- The mark reads as an "M" at 512 down to 16 px (subtle at 16 px, as expected for a
  blue-on-dark mark, but distinguishable in a tab).
- `npm run lint` and `npm run build` pass.
- Shipped via an approved PR (no straight-to-main).
