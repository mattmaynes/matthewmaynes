# 0010 - Blog pipeline review findings (spec 0009)

Persona review of PR #41 (engineer/tester/architect/security/designer). Two majors and a set of
minors; captured here per protocol. All fixes were code/test/docs - the post prose was untouched.

## Symptom

- **Sort criterion untested (tester, major).** The spec's "newest-first" acceptance was only
  exercised by `getAllPosts` against the real content dir, which has one post - so the ordering
  loop never ran and an inverted comparator would have passed green.
- **Cover framing (designer, major).** The post-page cover mat spanned the full ~1150px article
  width while the 192px pixel-art image rendered at intrinsic size - a tiny stamp on a huge mat,
  also wider than the 672px prose column, so the header read as misaligned.
- Minors: OG route would ENOENT if a `cover` omitted its extension; rendered date and cover
  thumbnail were unasserted; listing links had no themed focus state; the AGENTS.md carve-out
  understated that MDX executes at build; `next-mdx-remote` was caret-pinned unlike the exact-pinned
  `next`/`react`; the OG route was dynamic (relying on file-tracing) with no `generateStaticParams`;
  `architecture.md` still claimed Shiki highlighting that was deferred.

## Root cause

- A single-fixture acceptance test certifies the *data*, not the *logic*: with one row, sort,
  filter, and dedup all pass trivially. The comparator had no pure-function seam to test.
- The cover was styled as a full-bleed hero, which is wrong for a tiny fixed-resolution pixel asset
  and for a left-aligned reading column.

## Fix

- Extracted `sortPostsNewestFirst` as a pure, exported, non-mutating function; `getAllPosts` calls
  it, and a unit test asserts ordering + non-mutation against a multi-post fixture.
- Constrained the cover to the prose measure (`max-w-2xl`, left-aligned); the pixel art fills the
  width and upscales crisply (`image-rendering: pixelated`).
- Normalized the OG cover filename before `readFile`; added `generateStaticParams` to the OG route;
  added `.png`-agnostic notes; asserted the rendered date ("June 30, 2026") and the `turing-sunrise`
  cover asset in the smoke; added Canopy's focus-ring convention to the listing links; tightened the
  AGENTS.md MDX-safety wording; exact-pinned `next-mdx-remote`; corrected the `architecture.md` Blog
  bullet. Also wired the previously-unused `slugify` in as a build-time filename/title guard and made
  `<PostImage>` throw on an unknown key.

## Learning

See `overview/learnings.md` (Blog content pipeline). Headline: **an acceptance test over a
single-item fixture proves nothing about ordering/filtering logic - extract the logic into a pure
function and test it against a multi-item fixture**, the same "assert what the unit uniquely
produces" lesson (feedback 0001/0003/0006) applied to collection logic rather than page chrome.
