# 0029 - Home page: push visitors to the blog

## Problem

The home page treats every destination equally: one primary "About me" button in the
hero and a flat four-card "Around the site" grid (About / Resume / Blog / Contact). The
blog is the site's most active surface (new posts land regularly) yet the home page gives
a visitor no reason to go there and no taste of what is being published. We want the home
page to *streamline the paths* and *push people to the blog*.

For: first-time visitors landing on `/`, who should leave with either the "who is this"
story (About) or a fresh reason to read the blog.

## Outcome

Observable when done:

1. The hero shows **two** call-to-action buttons side by side: the existing primary
   **About me**, and a new secondary **Blog** button linking to `/blog`. The secondary
   button reads clearly against the dark hero photo overlay and is visually subordinate to
   the primary.
2. Below the "Around the site" cards, a new **Latest post** section highlights the single
   most recent post, rendered with the same row treatment as the `/blog` listing (cover
   thumbnail, title link, date, reading-time pill, excerpt, tags, and the "New" badge when
   applicable), followed by a link to the full listing (`/blog`).
3. If there are no posts, the section is omitted cleanly (no empty heading).

## Scope

**In:**
- Add the secondary "Blog" button to the hero in `src/app/page.tsx`.
- Add a "Latest post" section below the cards, reusing the shared `PostRow` component and
  the `toPostRows` server mapper.
- A smoke-test assertion proving the latest post surfaces on `/` (a unit-unique marker, not
  shared chrome).

**Out:**
- No change to the "Around the site" card grid contents or the intro copy.
- No new "latest N posts" list - only the single most recent post (a highlight, not a feed;
  the full feed already lives at `/blog`).
- No change to `/subscribe`'s existing bespoke "Latest post" card (untouched; a later
  cleanup could converge it onto `PostRow`, but that is not this spec).
- No new dependency, no design-system change.

## Approach

**Hero button.** Add a second `<Button asChild size="lg">` beside "About me" in the
existing `flex flex-wrap gap-3` wrapper, linking to `/blog`. The hero sits over a dark
`bg-overlay/60` layer, so the exact treatment is a *verify-in-browser* decision. A filled
`variant="secondary"` was tried first but two same-size saturated solids (blue primary +
brown secondary) read as co-equal rather than subordinate (design review). Final: a
`variant="outline"` with a light-border override (`border-base-white/70 bg-transparent
text-base-white`, matching the hero's white headshot border / tagline text) - translucent
and clearly lower-weight than the filled primary, and legible white-on-photo. Confirmed
against a screenshot.

**Latest post section.** The home page is already a Server Component, so it can call the
fs-backed blog core directly (like `/subscribe` does). Compute the rows server-side so the
content is fully in the SSG HTML:

```tsx
const NOW_MS = Date.now();                       // module scope - avoids react-hooks/purity
                                                 // (learnings 0012), = "new as of this build"
const posts = getAllPosts();
const rows = toPostRows(posts, newPostSlug(posts, NOW_MS, 30));
const latest = rows[0] ?? null;
```

Render `latest` through the shared `PostRow` inside a new `<section>` under the cards, with
an `<h2>Latest post</h2>` and a "Read the blog" / "See all posts" link (`Button
variant="outline"` to `/blog`, matching the `/subscribe` precedent). `PostRow` is a
hook-free presentational component already shared by a Server page (the tag archive) and the
client island (learnings 0027), so it renders here unchanged and stays visually identical to
the listing rows.

**Why `PostRow`, not the `/subscribe` card:** `PostRow` is the canonical, tested row shared
by the listing and tag archives; reusing it keeps the home highlight consistent and avoids a
third bespoke copy of post-card markup. `newPostSlug` is computed over the **full** post set
(not a subset) so the "New" badge stays a whole-corpus fact (learnings 0027).

## Acceptance

- [ ] Hero renders two CTAs: primary "About me" (unchanged) and a secondary "Blog" -> `/blog`.
- [ ] The secondary button reads legibly on the hero overlay (verified on a screenshot).
- [ ] A "Latest post" section appears below the cards showing the newest post via `PostRow`
      (cover, title link to `/blog/<slug>`, date, reading-time pill, excerpt, tags; "New"
      badge when the post is within the recency window).
- [ ] A "see all posts" link to `/blog` sits below the highlight.
- [ ] With zero posts the section (and its heading) does not render.
- [ ] The `/` smoke test asserts a unit-unique marker for the latest-post section (e.g. the
      newest post's title linked to its `/blog/<slug>` href) so reverting the section reddens.
- [ ] `npm run lint`, `npm test`, and `npm run build` are green.
```

