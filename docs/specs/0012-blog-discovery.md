# 0012 - Blog discovery: tag filter, search, and "New" badge

## Problem

The blog listing (`/blog`) is a flat, newest-first list with no way to narrow it. Tags render as
inert pills, so a reader interested in one theme (Leadership, Nature) cannot filter to it, and there
is no way to search across posts by keyword. There is also no visual cue for what is newly
published. As the post count grows this list becomes hard to navigate.

## Outcome

On `/blog`:

- **Tag filtering.** Tag pills become interactive filters. Selecting a tag shows only posts carrying
  it; an "All" state clears the filter. The active tag is reflected in the URL (`?tag=leadership`)
  so a filtered view is shareable and bookmarkable.
- **Search.** A search input filters the visible posts by keyword, matching title, excerpt, and
  tags, live as the reader types. Search and tag filter compose (search within the active tag).
- **"New" badge.** The most recently published post carries a "New" pill, so first-time visitors see
  what just landed. It is time-bounded (only while the newest post is within ~30 days of its date)
  so it does not become permanent furniture.

Empty state: if a filter/search matches nothing, the page shows a clear "No posts match" message
rather than a blank list.

## Scope

**In**

- A client-side filtering/search island for the listing (the content stays statically generated;
  filtering runs in the browser over the already-rendered post set).
- Tag pills on the listing become filter controls; URL `?tag=` sync.
- Search input over title/excerpt/tags.
- "New" badge on the newest post (date-gated), on the listing.

**Out**

- Full-text search of post **bodies** (index-based / server search) - keyword match over
  title/excerpt/tags only.
- Filtering on the individual post page (its tags may deep-link to `/blog?tag=` but that is the
  extent).
- Pagination (not needed at current volume).
- Reading-time/byline (spec 0011), RSS (spec 0013).

## Approach

- The listing is a Server Component today. Introduce a **client island** (e.g.
  `src/components/blog-list.tsx`, `"use client"`) that receives the already-loaded, serializable
  post summaries (slug, title, excerpt, date, tags, cover key) as props from the server page, and
  owns the filter/search UI + state. Covers stay `next/image` static imports resolved on the server
  and passed down, or the island renders from the cover key via the existing `getBlogImage` map -
  pick whichever keeps the blur placeholders intact (learnings 0005).
- **Tag state** initializes from `?tag=` (via `useSearchParams`) and updates the URL with
  `router.replace` on change (no scroll jump); unknown/absent tag = "All". Tag set is derived from
  the posts (union of `post.tags`), so no separate config.
- **Search** is a controlled input; match is a case-insensitive substring over
  `title + excerpt + tags.join(" ")`. Debounce is optional at this volume.
- **"New"** is a pure predicate (testable): the newest post (first in the newest-first order) with
  `date` within N days of a reference date. To stay deterministic and avoid `Date.now()` in
  build/SSR surprises, compute "is newest" purely and gate the "recent" window in the client island
  (or accept a small helper `isRecent(date, now, days)` unit-tested with injected `now`). Badge
  renders as a distinct accent pill (warm gold Harbor accent) so it reads apart from tag pills.
- **Empty state** reuses the existing dashed-border "No posts yet" block styling with match-aware
  copy.

## Acceptance

- [ ] Selecting a tag filters the list to matching posts; "All" clears it; `?tag=` reflects and
      restores the active tag on load.
- [ ] Typing in search narrows the list by title/excerpt/tags; composes with the active tag.
- [ ] A no-match filter/search shows a clear empty message, not a blank list.
- [ ] The newest post shows a "New" badge while within the recency window; older posts never do.
- [ ] Tag-selection and "recent" logic have unit tests (pure predicates, injected `now` - no
      wall-clock in the test).
- [ ] Keyboard/focus states preserved on the new controls (focus-visible rings, as elsewhere).
- [ ] `npm run lint`, `npm test`, `npm run build` green; listing smoke assertion updated to cover a
      filter/search/badge marker.
