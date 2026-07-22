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
- Nothing else changes: the header brand is a text wordmark and the OG cards / emails use the
  headshot, so the "M" only surfaces as the favicon/app-icon set.

## Scope

**In**

- Add `public/brand/logo-m.svg` - the vector mark (512 viewBox, full-bleed Harbor-dark
  background, blue node-graph "M", gold accent node).
- Replace `public/brand/logo-m.png` with a 1024x1024 full-bleed master rendered from the SVG.
- Regenerate the derived set via `node scripts/build-icons.ts`: `src/app/icon.png` (512),
  `src/app/apple-icon.png` (180), `public/icon-192.png`, `public/icon-512.png`, and
  `src/app/favicon.ico` (16/32/48).
- Update the `build-icons.ts` header comment to name the SVG as the vector source and record
  the `qlmanage` render step for the PNG master.

**Out**

- The manifest theme/background colour (`#14222f`) is unchanged - it already sits well with the
  new dark icon.
- No new build dependency: rendering the SVG master uses macOS `qlmanage` (Quick Look), matching
  the pipeline's existing macOS-only, `sips`-based, dependency-free approach.

## Approach

The mark is defined once as an SVG. The raster master is rendered from it with Quick Look
(`qlmanage -t -s 1024 -o <dir> public/brand/logo-m.svg`) and committed as `logo-m.png`; the
existing `build-icons.ts` then fans it out to every size with `sips` and packs the multi-res
`.ico` with Node stdlib. Editing the mark later means: edit the SVG, re-render the PNG master,
re-run the script.

## Acceptance

- All six icon assets regenerate at their expected dimensions; `favicon.ico` carries 16/32/48
  frames.
- The mark reads as an "M" at 512 down to 16 px (subtle at 16 px, as expected for a
  blue-on-dark mark, but distinguishable in a tab).
- `npm run lint` and `npm run build` pass.
- Shipped via an approved PR (no straight-to-main).
