# 0011 - Blog post reading experience

## Problem

The individual post page (`/blog/[slug]`) reads thin and anonymous. Body copy is set at
`text-body` (16px) - small for long-form reading - and the header carries only a date and tag
pills. There is no reading-time estimate, no author attribution, and no disclaimer distinguishing
personal opinion from an employer position. For a public, single-author site where posts are
personal reflections, the page should feel authored and comfortable to read.

This is the first spec of the blog-improvements group; it owns the shared reading-time helper that
later specs may reuse.

## Outcome

On every `/blog/[slug]` page:

- **Body copy is larger and more comfortable.** The MDX prose renders at `text-lg` (18px) with
  relaxed line-height, up from `text-body` (16px). Headings/spacing stay in proportion.
- **A reading-time pill** sits in the post header meta row: a `Clock` icon (`@rogueoak/icons`) plus
  "N min read", estimated from the post body word count.
- **A byline** shows below the title: a small circular avatar (the existing `headshot` image) next
  to "By Matthew Maynes".
- **A disclaimer** appears after the body (before "Back to blog"): a small, muted line - "The
  thoughts and views expressed here are my own." - so readers do not read a post as an employer
  statement.

Editorial bolding of key phrases within post prose is handled as a separate content edit, not here.

## Scope

**In**

- Post page header: byline + avatar, reading-time pill.
- Post body typography bump (`text-lg`) in `src/components/post-body.tsx`.
- Post footer disclaimer.
- `estimateReadingMinutes(content)` added to the pure JS core (`src/lib/blog.js`) + typed wrapper,
  unit-tested against a multi-length fixture.

**Out**

- The blog **listing** page typography and meta (unchanged here).
- Reading-time on the listing rows (could follow later; listing already shows a date).
- Tag filtering, search, "New" badge (spec 0012).
- RSS (spec 0013).
- Frontmatter/content edits (date, Reflection tag, bolding) - separate content PR.

## Approach

- **Reading time** is a pure function so it is testable without a build (the `blog.js`/`theme.js`
  seam pattern): strip MDX/markdown syntax to words, divide by ~200 wpm, `Math.max(1, round)`.
  Returns an integer. Export through `blog.ts` as `readingMinutes(post)` or compute in the page from
  `post.content`. Add a `blog.test.mjs` case asserting a known fixture's minute count and the
  1-minute floor.
- **Avatar** reuses the static-imported `headshot` from `src/lib/site.ts` `images` (no new asset, no
  PII) via `next/image`, rendered `rounded-full` at ~28-32px. Byline row: avatar + "By
  {site.name}".
- **Pill** matches the existing tag-pill shape (`rounded-full border border-border bg-muted px-3
  py-1 text-caption text-text-muted`) with an inline `Clock` icon; icons import through the
  `src/components/social-icons.tsx` client boundary pattern (learnings 0007) if a Server Component
  cannot import `@rogueoak/icons` directly.
- **Typography** change is localized to the `p` (and any `li`) mapping in `post-body.tsx`
  (`text-body` -> `text-lg leading-relaxed`); verify headings/blockquote still balance.
- **Disclaimer** is a static muted `<p>` in `[slug]/page.tsx` after `<PostBody>`.

## Acceptance

- [ ] Post body renders at 18px (`text-lg`); listing unchanged.
- [ ] Header shows a `Clock` reading-time pill with a plausible "N min read" (>= 1).
- [ ] Byline "By Matthew Maynes" with a round avatar renders below the title.
- [ ] Disclaimer line renders after the body on every post.
- [ ] `estimateReadingMinutes` is a pure export with a unit test covering a multi-paragraph fixture
      and the 1-minute floor.
- [ ] `npm run lint`, `npm test`, `npm run build` green; post page smoke assertion updated to check
      a reading-time / byline marker so the feature cannot silently regress (learnings 0001/0003).
