# 0028 - blog tag filter as a Canopy Combobox

## Problem

The blog listing's tag filter is a hand-rolled row of pill `<button>` chips (an "All" chip plus
one per derived tag) in `src/components/blog-list.tsx`. Now that Canopy ships a real `Combobox`
(canopy spec 0030, released in `@rogueoak/canopy` 0.7.0), the filter should use the design-system
component instead of bespoke chip markup - one styled, accessible, type-to-filter control that
matches the rest of the site's Canopy surface and scales as the tag set grows.

## Outcome

- The tag filter on `/blog` is a single-select Canopy `Combobox` (from the `@/components/ui`
  client boundary), replacing the chip `<ul>`.
- Behaviour is preserved: the active tag still lives in the URL (`?tag=`), the view is still
  shareable/bookmarkable, and the same pure `filterPosts` / `resolveActiveTag` core drives the
  list. A leading **"All posts"** entry clears the filter (the old "All" chip).
- Selecting a tag filters the list, updates the URL, and shows a check on the active option;
  selecting "All posts" restores the full list and clears the query param.
- The search-by-text input and the post rows (including their tag pills) are unchanged.
- Tags remain discoverable in the SSR HTML via each post row's tag pills (the Combobox options
  are portalled/client-revealed), so there is no SEO regression from the swap.

## Scope

**In**
- Bump `@rogueoak/canopy` / `@rogueoak/roots` / `@rogueoak/icons` to `^0.7.0` (lockstep; Combobox
  ships in canopy 0.7.0 on the `./branches` subpath).
- Export `Combobox` + `ComboboxOption` from the `@/components/ui` client boundary.
- Replace the chip `<ul>` in `blog-list.tsx` with the `Combobox` (options = "All posts" + derived
  tags; `value` = active tag; `onValueChange` -> the existing `selectTag`).
- Update the `/blog` smoke marker from the `>All<` chip to the Combobox's default `"All posts"`
  trigger label.

**Out**
- Multi-tag filtering - the filter stays single-select (one tag or all), preserving today's
  semantics. (Canopy's Combobox supports multi-select with badges; adopting it here would change
  `filterPosts`, the URL contract, and the tag-page routes - a separate change if wanted.)
- Restyling the post-row tag pills or the search input.
- Any change to the tag archive pages (`/blog/tags/[tag]`).

## Approach

Single-select `Combobox` bound to the URL-backed tag state. Options are `[{label:"All posts",
value:""}, ...allTags.map(t => ({label:t, value:t}))]`; `value={activeTag ?? ""}`;
`onValueChange` maps `""` back to `null` and calls the existing `selectTag`, which writes
`?tag=` via `history.replaceState` and pokes the `useSyncExternalStore` subscribers (unchanged).
The Combobox renders through the existing `"use client"` `ui.ts` boundary (Canopy's dist carries
no `"use client"`), and the site already wires Canopy tokens + the `@source` scan, so it themes
with the Harbor brand automatically.

## Acceptance

- [ ] `/blog` renders the Combobox tag filter (default label "All posts") next to the search input.
- [ ] Selecting a tag filters the list to that tag and sets `?tag=<tag>`; the active option shows a
      check; the popover closes.
- [ ] Selecting "All posts" restores the full list and clears the query param.
- [ ] The pure `filterPosts` / `resolveActiveTag` unit tests are unchanged and green; the `/blog`
      smoke test passes with the updated "All posts" marker.
- [ ] `npm run lint`, `npm run build`, and `npm test` all pass.
- [ ] Verified interactively in a browser (filter, clear, URL updates).
