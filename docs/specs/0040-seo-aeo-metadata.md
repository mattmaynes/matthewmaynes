# 0040 - SEO & AEO metadata (structured data, llms.txt, canonicals)

## Problem

The site already ships the mechanical SEO basics (spec 0004): `robots.txt`, `sitemap.xml`, OG /
Twitter cards, a web manifest, and a single JSON-LD `Person`. But two audiences are under-served:

- **Search engines** get no per-page canonical URL and no article-level structured data. Blog
  posts - the site's main indexable surface - carry no `BlogPosting` schema, so Google has no
  machine-readable headline / author / date / section to build a rich result from, and the
  tag/category archives list the same posts under multiple URLs with no canonical to consolidate
  ranking signal.
- **Answer engines / AI crawlers** (ChatGPT, Claude, Perplexity, Google AI) have no `llms.txt` -
  the emerging convention for a curated, plain-markdown map of a site - so they must infer
  structure from HTML. The lone `Person` node also omits the facts an answer engine leans on to
  describe *who this is* (employer, areas of expertise, a description).

This is the discovery/structured-data layer only. It is a `src/` pipeline change, so it follows the
full Spectra protocol (not the lightweight content carve-out).

## Outcome

- **`/llms.txt`** exists: a build-generated, plain-markdown briefing an AI crawler can read - who
  Matthew is, the primary pages (absolute URLs), and every published blog post (title, URL, date,
  one-line excerpt), plus pointers to the RSS feed and AI-policy page. It regenerates on the shared
  60s ISR window like the sitemap, so a newly published post appears with no deploy.
- **Every page emits a self-referential canonical URL** (`<link rel="canonical">`), so duplicate
  paths (a post reachable from `/blog`, its tag archive, and its category archive) consolidate onto
  one URL.
- **Each published blog post carries `BlogPosting` + `BreadcrumbList` JSON-LD** with headline,
  description, `datePublished`/`dateModified`, `author` (the site `Person`), `image` (the post's OG
  card), `keywords` (tags), `articleSection` (category), `wordCount`, and `mainEntityOfPage`. Drafts
  and not-yet-due scheduled posts emit none (parity with the existing per-post OG gating).
- **The homepage carries a `WebSite` node and `/blog` carries a `Blog` node**, both attributed to
  the `Person` as author/publisher, so an engine can tie the posts to a named site and author.
- **The site-wide `Person` node is enriched** with `worksFor` (current employer, sourced from the
  already-public `resume.ts`), a `description`, and `knowsAbout` (areas of expertise) - no new PII.

## Scope

**In**

- New `src/app/llms.txt/route.ts` route handler (`revalidate = 60`), rendering markdown from a pure,
  fs-free builder `src/lib/llms.ts` (unit-tested, like `rss.ts`) fed by `getPublishedPosts()`, `nav`,
  and `site`. Content type `text/plain; charset=utf-8` (the llms.txt convention).
- New pure `src/lib/structured-data.ts`: builders returning plain JSON-LD objects
  (`personJsonLd`, `websiteJsonLd`, `blogJsonLd`, `blogPostingJsonLd(post, ...)`,
  `breadcrumbListJsonLd(items)`) from `site` / `identity` / a post. A shared `<JsonLd data={...}>`
  presentational component (escapes `<` as `<`, matching the existing layout inline) so every
  surface injects identically.
- Move the existing inline `Person` object in `layout.tsx` into `structured-data.ts`, enriched with
  `worksFor` (from `resume.work[0].company`, the current role), `description`, and `knowsAbout`.
- Add `WebSite` JSON-LD to `/` (`src/app/page.tsx`) and `Blog` JSON-LD to `/blog`
  (`src/app/blog/page.tsx`).
- Add `BlogPosting` + `BreadcrumbList` JSON-LD to the **published** post route
  (`src/app/blog/[slug]/page.tsx`) only - gated behind the same `isPublishedNow` check the page and
  OG route already use, so nothing leaks before `publishAt`.
- Add `alternates.canonical` to every indexable page's metadata: `/`, `/about`, `/resume`,
  `/projects`, `/projects/[slug]`, `/blog`, `/blog/[slug]`, `/blog/tags/[tag]`,
  `/blog/categories/[slug]`, `/contact`, `/subscribe`, `/links`, `/ai-policy`. Canonicals
  are path-relative (resolved against the existing `metadataBase`). The `noindex` preview routes
  (`/blog/drafts*`, `/login`) get **no** canonical (they must not be indexed at all).
  **`/privacy` is the one indexable page deliberately left without an explicit canonical** - see
  Approach; it relies on the browser / search-engine default self-canonical instead.
- Tests: unit tests for `llms.ts` (multi-post fixture: every published post present, drafts absent,
  absolute URLs) and `structured-data.ts` (required fields, draft post omitted at the route);
  a smoke assertion that `/llms.txt` returns `200` + `text/plain` and names a known post; per-surface
  assertions that a canonical is emitted and that a draft post's page emits no `BlogPosting`.

**Out**

- **Full-text RSS (`content:encoded`)** - deferred to its own spec. It changes the *feed rendering
  pipeline* (MDX -> HTML with the custom `<PostImage>`/`<PostVideo>` components), a different
  subsystem from this metadata work, with real rendering-fidelity risk. Batching it here would
  couple two independently shippable features in one PR (against the one-feature-per-PR rule). The
  `llms.txt` links + enriched structured data already give answer engines the content map they need.
- **`/llms-full.txt`** (full post bodies inlined) - superseded by the deferred full-text feed above;
  reconsider once that ships.
- Explicit AI-crawler allow/deny rules in `robots.txt` - the current `allow: /` already welcomes
  every crawler (GPTBot, ClaudeBot, PerplexityBot, Google-Extended), which is the intended AEO
  stance; making it verbose adds no behaviour.
- Any visual/UI change - this is head/metadata + a text route only.

## Approach

Mirror the existing metadata architecture (spec 0004): one source of truth in `site.ts`/`identity.ts`,
pure fs-free builders under `src/lib` that `node --test` covers without a server, and thin route/page
shells. JSON-LD is built by pure functions and rendered by one shared `<JsonLd>` component, so the
five node types can't drift in their escaping. Canonicals piggyback on the metadata each page already
exports (`metadataBase` is set, so a path string suffices). The post-level nodes reuse the page's
existing `isPublishedNow` guard, so the "never leak a draft" invariant (learning 0019/0034) is
enforced by the same check, not a parallel one.

Key decision - **`/privacy` gets no explicit canonical**: `/privacy` sits behind a content-freshness
gate (`scripts/check-privacy-date.ts`) that hashes the whole page source with only the "Last updated"
date normalized out. Adding a canonical to its metadata would move that hash, and the only sanctioned
way to clear the gate is `npm run privacy:stamp`, which bumps the user-facing "Last updated" date -
a false signal that the policy text changed when only a head link was added. Since `/privacy` is a
footer utility not in the sitemap, it is left to the default self-canonical rather than corrupting
that date. (`/ai-policy`, also a footer utility, has no such gate, so it keeps its canonical.)

Key decision - **`worksFor` sourced from `resume.ts`, not a new constant**: the current employer is
already public there (`resume.work[0]`), so reusing it avoids both new PII and a second place to
update. It is *not* added to `identity.ts`, whose hash gates the resume-PDF freshness check - a field
the PDF doesn't render would flag the PDF stale for no reason.

## Acceptance

- [ ] `/llms.txt` returns `200` + `text/plain`, lists every published post with an absolute URL, and
      omits drafts / not-yet-due scheduled posts.
- [ ] Every indexable page (except `/privacy`, see Approach) emits exactly one self-referential
      `<link rel="canonical">`; the `noindex` preview routes emit none.
- [ ] A published post's HTML contains `BlogPosting` + `BreadcrumbList` JSON-LD with the required
      fields; a draft/scheduled post's page contains neither.
- [ ] `/` emits `WebSite` JSON-LD and `/blog` emits `Blog` JSON-LD; the `Person` node carries
      `worksFor`, `description`, and `knowsAbout`.
- [ ] All new JSON-LD validates as well-formed (parses; `@context`/`@type` present) and contains no
      PII beyond what is already public.
- [ ] `npm run lint`, `npm run build`, and `npm test` pass.
- [ ] Shipped via an approved PR (no straight-to-main), persona-reviewed.
