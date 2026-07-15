# 0017 - Draft exclusion left secondary render surfaces unguarded

## Symptom

Spec 0034 acceptance #1 requires a draft to be absent from **every** public surface. The first cut of
the smoke tests guarded the obvious ones - the `/blog` listing, the RSS feed, and the draft's post URL
in the sitemap - but left two surfaces that also render a post unguarded:

- **`/subscribe`** renders a "Latest post" block (the newest post by date). The car draft is dated
  `2026-07-14`, the newest of all posts, so a revert of `/subscribe` from `getPublishedPosts()` to
  `getAllPosts()` would surface the draft as "Latest post" with every existing marker still green.
- **Per-tag archives.** A tag unique to a draft would, on a tag-path revert to `getAllPosts()`, spawn a
  reachable `/blog/tags/<slug>` page listed in the sitemap - and the sitemap check only asserted the
  draft *post* URL was absent, not its tag-archive URLs.

The home-page "Latest post" slot was covered only *transitively* (its test derives the newest slug from
`/blog`), not by a direct assertion on the surface itself. (Caught by the tester persona on PR #125.)

## Root cause

When guarding an "entity hidden from surface X" criterion, I enumerated the headline surfaces (listing,
feed, sitemap post URL) but not the full set of surfaces that render a post. A blog post is rendered by
more than the listing: the home latest slot, the `/subscribe` latest block, every per-tag archive, the
prev/next nav, the OG card, and the sitemap's tag URLs. Each is an independent exclusion surface, and a
per-surface `getAllPosts()`/`getPublishedPosts()` choice can regress independently.

## Fix

- Add the draft title to `/subscribe`'s `absent` markers in the smoke suite.
- In the sitemap smoke test, assert every tag UNIQUE to the draft (not shared with a published post) is
  absent from the sitemap AND that its `/blog/tags/<slug>` 404s.
- (The exclusion code itself was already correct - `/subscribe` and the tag pages already use
  `getPublishedPosts()`; the gap was purely in the tests' ability to catch a regression.)

## Learning

An exclusion acceptance ("hidden from every public surface") needs a failable marker on **every** surface
that renders the entity, enumerated explicitly - not just the headline listing. Secondary surfaces (a
"latest post" block, per-tag archives, prev/next nav, OG cards, sitemap tag URLs) each render the entity
and each regress independently, so each needs its own direct guard. A surface covered only *transitively*
(the home slot derives from `/blog`) is not a substitute for a direct assertion on that surface. This
generalizes the recurring "assert what the unit uniquely produces" lesson to *set-exclusion across many
surfaces*: list the surfaces, guard each. Feeds `overview/learnings.md`.
