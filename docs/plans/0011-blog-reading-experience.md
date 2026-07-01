# Plan 0011 - Blog post reading experience

Source spec: `docs/specs/0011-blog-reading-experience.md`.

## Steps

1. **Reading-time core (pure JS seam).** In `src/lib/blog.js`, add and export
   `estimateReadingMinutes(content)`: strip MDX/markdown noise (frontmatter is already gone by the
   time we hold `content`; strip fenced code, `<PostImage .../>` and other JSX tags, markdown link
   syntax/URLs, `#`/`*`/`>`/backtick markers), split on whitespace to count words, divide by 200 wpm,
   `Math.max(1, Math.round(...))`. Pure, deterministic, no `Date`/`Math.random`.
2. **Typed wrapper.** In `src/lib/blog.ts`, export `readingMinutes(post: Post): number` delegating to
   the JS core (mirrors the existing `getAllPosts`/`getPostBySlug` typed-wrapper style). Keep the
   `Post` type unchanged.
3. **Clock icon boundary.** Add a `ClockIcon` wrapper to `src/components/social-icons.tsx` (already a
   `"use client"` module) over `@rogueoak/icons` `Clock`, `aria-hidden` by default - the same pattern
   as the brand glyphs, so the Server-Component post page can render it (learnings 0007).
4. **Post header meta (`src/app/blog/[slug]/page.tsx`).**
   - **Reading-time pill:** next to the date, a pill matching the tag-pill shape
     (`inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1
     text-caption text-text-muted`) with `<ClockIcon className="h-3.5 w-3.5" />` + `{minutes} min
     read`. Compute `readingMinutes(post)` in the server component.
   - **Byline:** below the title, a row with a round avatar and "By {site.name}". Use the
     static-imported `images.headshot` (or the site headshot import) via `next/image`,
     `className="h-8 w-8 rounded-full object-cover"`, `alt` empty/decorative (name is adjacent text).
     Confirm the exact export name in `src/lib/site.ts` `images` before wiring.
   - **Disclaimer:** after `<PostBody>` and before the "Back to blog" button, a muted line:
     `<p className="mt-10 text-caption text-text-subtle italic">The thoughts and views expressed
     here are my own.</p>`.
5. **Body typography bump (`src/components/post-body.tsx`).** Change the `p` mapping from
   `text-body` to `text-lg leading-relaxed` (18px). Check `li` and `blockquote` still balance; bump
   `li` to `text-lg` too if it shares the body measure. Do NOT touch the listing page.
6. **Tests.**
   - `tests/blog.test.mjs`: add a test importing `estimateReadingMinutes` - assert a known
     multi-paragraph fixture yields the expected integer, and that a 1-2 word string returns the
     1-minute floor. Assert it ignores a `<PostImage>` tag / code fence (does not count markup as
     words).
   - `tests/smoke.test.mjs`: extend the `/blog/i-picked-the-wrong-elective` case `contains` with a
     stable marker for the new chrome - "min read" and "By Matthew Maynes" and the disclaimer phrase
     "views expressed here are my own" - so a reverted feature reddens the smoke test (learnings
     0001/0003/0006).
7. **Verify:** in the worktree run `npm ci` (worktree needs its own node_modules - learnings feedback
   0006), then `npm run lint`, `npm test`, `npm run build`. All green before commit.
8. **Reflect:** update `docs/overview/features.md` (blog post page now shows reading time, byline,
   disclaimer; body at larger measure) and `docs/overview/architecture.md` only if the seam story
   changed (note `estimateReadingMinutes` joins the pure `blog.js` core). No forced learning unless
   friction surfaced.

## Files touched

- `src/lib/blog.js` (new export), `src/lib/blog.ts` (typed wrapper)
- `src/components/social-icons.tsx` (ClockIcon), `src/components/post-body.tsx` (p size)
- `src/app/blog/[slug]/page.tsx` (pill, byline, disclaimer)
- `tests/blog.test.mjs`, `tests/smoke.test.mjs`
- `docs/overview/features.md` (+ maybe `architecture.md`)

## Verification checklist

- [ ] `estimateReadingMinutes` unit test (fixture count + 1-min floor + ignores markup) passes.
- [ ] Post body renders 18px; listing unchanged.
- [ ] Header shows Clock pill "N min read", byline "By Matthew Maynes" + round avatar.
- [ ] Disclaimer renders after the body.
- [ ] Smoke test asserts the new markers.
- [ ] lint + test + build green.
