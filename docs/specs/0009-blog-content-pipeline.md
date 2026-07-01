# 0009 - Blog content pipeline + first post

## Problem

`/blog` and `/blog/[slug]` are still the walking-skeleton placeholders: the listing renders
"No posts yet" and any slug resolves to a `PagePlaceholder` stub that literally says "The MDX
pipeline and real posts arrive in a later spec." `architecture.md` and `features.md` already
commit the design (MDX in `content/blog/*.mdx`, frontmatter `title`/`date`/`tags`/`excerpt`, tag
groups Technical/Leadership/Nature/Life, newest first, static generation at build). Matthew has
written the first post ("I Picked the Wrong Elective") but there is no pipeline to render it, and
it has no cover image. This spec builds the pipeline that turns a tracked `.mdx` file into a live,
shareable post - with a real-first cover policy (real photo > stock > generated) - so this first
post ships.

Audience (same as `/about`): the personal-brand visitor and industry peers, not a recruiter
screen. The post is a first-person, prose narrative with no code blocks.

## Outcome

When done:

- A tracked `content/blog/i-picked-the-wrong-elective.mdx` (PII-free, spell-checked in Canadian
  English, formatted per `docs/rules/`) renders at `/blog/i-picked-the-wrong-elective` with the
  site's typography, a post header (title, formatted date, tags), a cover image, the body, and a
  "Back to blog" link.
- `/blog` lists real posts newest-first - each row a cover thumbnail, title, date, excerpt, and
  tag labels - with the placeholder gone. One post today; the list grows by dropping a file in
  `content/blog/`.
- Every post has a **cover, chosen by a fixed preference order: real photo > stock photo >
  generated card.** A `cover` frontmatter field points at a tracked, EXIF-scrubbed
  `public/images/blog/<slug>.*` (static-imported for the blur placeholder, exactly like the site's
  other images). The ideal is Matthew's own photograph; a licensed stock photo is the fallback when
  no good original exists; a `next/og` (satori) card is the last-resort backstop only, not the
  norm.
- The cover doubles as the post's Open Graph / Twitter share card, so a pasted link yields a rich
  per-post preview. When a post has no cover image at all, the generated card fills the share slot
  so previews never break - but the visible page still prefers a real image.
- Pages are statically generated at build (`generateStaticParams` over the content dir); no
  runtime fetching, no database.

## Scope

**In**

- **Content:** author the post as `content/blog/i-picked-the-wrong-elective.mdx` with frontmatter
  (`title`, `date: 2026-06-30`, `tags: [Life]`, `excerpt`). Spell-check in Canadian English and
  apply the repo writing/formatting rules (`docs/rules/guidelines.md`: no long dashes).
- **Loader seam:** `src/lib/blog.ts` (+ a plain-JS `.js` core if logic needs `node --test`
  coverage without a TS build) that reads `content/blog/*.mdx`, parses frontmatter, validates
  required fields, derives the slug from the **filename** (the `.mdx` basename), and exposes
  `getAllPosts()` (sorted newest-first) and `getPostBySlug(slug)`. The filename is authored to be
  the title, lowercased and dash-separated (e.g. "I Picked the Wrong Elective" ->
  `i-picked-the-wrong-elective.mdx`), so the URL reads as the title.
- **Render:** compile the MDX body in a Server Component and render it with prose styling built
  from Roots/Harbor tokens (headings, paragraphs, the `---` section rules the post uses, links,
  and inline images). Inline images - e.g. the Zombie Horde screenshot in this post - render via
  `next/image` from a tracked, EXIF-scrubbed, static-imported `public/images/blog/` asset so they
  get the blur placeholder (learnings 0005), the same treatment as the site's other photos. This
  needs an MDX `img` component mapping (or an explicit image component the post uses).
- **`/blog` listing:** replace the placeholder with the real list (cover thumbnail, title, date,
  excerpt, tag labels), newest-first, responsive, themed.
- **`/blog/[slug]` page:** replace the placeholder; `generateStaticParams` + real
  `generateMetadata` (per-post `<title>`, description from excerpt, per-post OG image).
- **Cover, real-first:** the `cover` frontmatter field resolves a tracked, EXIF-scrubbed
  `public/images/blog/<slug>.*`, static-imported so the listing thumbnail and post header get the
  blur placeholder (learnings 0005). This real image is also the post's OG/Twitter share card. Only
  when a post carries no `cover` does the satori fallback (`app/blog/[slug]/opengraph-image.tsx`,
  1200x630, `_og`-font pattern) generate a branded card - used for the share slot so link previews
  never break, and shown on-page only as a last resort.
- **Tests:** a `blog.ts` unit test (frontmatter parse, required-field failure, sort order) and a
  tightened `/blog` + `/blog/[slug]` smoke (route-unique post copy present, placeholder gone, the
  post's `og:image` path returns `200` with an image type - the satori fallback specifically as
  `image/png`).
- **Process carve-out:** update `AGENTS.md` so that authoring a blog post (content under
  `content/blog/`) does **not** require the full Spectra protocol - no spec, plan, or persona
  review. It still requires a Canadian-English spell-check, the repo formatting rules
  (`docs/rules/guidelines.md`), and a PR approved before merge. The blog *pipeline and tooling*
  (anything under `src/`, deps, config) stays under the full protocol. Placed outside the
  `spectra:`-managed block so `/spectra-update` will not overwrite it.
- **Reflect:** flip the `/blog` and `/blog/[slug]` rows in `features.md` from placeholder to live.

**Out** (later / other specs)

- **Interactive tag filtering.** Tags render as labels now; client-side filtering is not worth its
  state at one post. Follow-up spec when the archive justifies it.
- **Syntax highlighting (Shiki / `rehype-pretty-code`).** This post has no code. Wire it in with
  the first code-bearing post so we are not carrying an unused toolchain.
- **Home-page "latest posts" strip.** `/` is still a placeholder; its blog integration rides with
  the home spec.
- **Comments.** The post's closing line references a comment section; that is a separate feature
  (needs a backend and spam story, cf. the contact form) and is not built here.
- **RSS/Atom feed, reading time, pagination, related posts.** Follow-ups once there are enough
  posts to matter.

## Approach

- **Content as data, matching `architecture.md`.** Posts are `.mdx` under `content/` (tracked,
  no PII); slug = filename, and the file is named as the title lowercased and dash-separated so the
  URL reads as the title. The loader is the single seam every surface (listing, post page, OG
  route) reads, so nothing re-parses files ad hoc.
- **MDX compilation.** Compile the body in an RSC via `next-mdx-remote` (its `/rsc` entry) or
  `@mdx-js/mdx` directly - the smallest credible option the build settles on. This is a **new
  dependency** and a security-review touch-point (it executes/serves authored content); it only
  ever compiles our own tracked files, never user input. Prose styling comes from Harbor tokens
  (a scoped `.prose`-style block or per-element MDX component map), not a hard-coded palette, so
  light/dark theme for free.
- **Frontmatter.** Parse with `gray-matter` (tiny, ubiquitous) or a hand-rolled splitter in the
  repo's "no-new-dep" tradition (cf. the ICO packer, OG-font copier) - the build picks; either
  way, missing/`malformed` required fields fail the build loudly, not silently at runtime.
- **Cover is a real image first.** Images should feel real - ideally Matthew's own photograph,
  scrubbed and static-imported like every other image on the site (`public/images/`, EXIF/GPS
  stripped, blur placeholder per learnings 0005). A licensed stock photo is the fallback when no
  good original exists. The satori generator is retained only as the share-card backstop for a
  post that has no cover at all, so link previews never break - it is deliberately not the default
  and should be rare. This inverts the earlier "generate by default" sketch per the developer's
  direction.
- **Testing follows the house rules.** Assert route-unique post copy, not shared chrome
  (learnings 0001/0003); tighten the placeholder->real guard in the same PR (learnings, Content
  pages 0003); verify the generated OG image actually renders `200 image/png` rather than assuming
  the route compiled (learnings 0004). Put loader logic in a testable seam so `node --test` covers
  it without booting a server.

## This post's images - resolved

Both are real artifacts from the game (best case for the real-first policy), scrubbed and
committed as PNG under `public/images/blog/`:

- **Cover: `turing-sunrise.png`** (192x132) - an actual in-game frame rendered in Turing, pixel
  art. Presented preserving its retro character: no blurry upscale. On-page it renders in a
  contained frame with `image-rendering: pixelated` (nearest-neighbour) on a dark mat; the 1200x630
  OG card composes it centred on a dark canvas rather than stretching it. This is the visible cover
  and the share image.
- **In body: `zombie-horde-title.png`** (800x147) - the chrome "ZOMBIE HORDE" title graphic. A flat
  graphic, so PNG per the repo convention. Placed right after the paragraph that introduces the
  game ("A few friends and I wrote a video game... Zombie Horde"), via `next/image` with a blur
  placeholder and alt text. It is not the cover.

Both were EXIF-scrubbed on import (sips re-encode; verified no GPS/make/model) per the public-repo
rule.

## Acceptance

- [ ] `content/blog/i-picked-the-wrong-elective.mdx` is tracked, PII-free, spell-checked in
      Canadian English, and free of long dashes (`docs/rules/guidelines.md`), with valid
      `title`/`date`/`tags`/`excerpt` frontmatter.
- [ ] `AGENTS.md` carries the blog-post carve-out (no Spectra spec/plan/persona for a post; still
      Canadian-English spell-check + formatting + an approved PR), placed outside the
      `spectra:`-managed block.
- [ ] `/blog/i-picked-the-wrong-elective` renders the post header, cover, full body, and back
      link with Harbor typography; no "Placeholder" badge.
- [ ] `/blog` lists the post (cover thumb, title, date, excerpt, tags), newest-first, with the
      placeholder gone; adding a second `.mdx` would list it with no code change.
- [ ] A `cover` frontmatter image (tracked, EXIF-scrubbed, static-imported) renders as the listing
      thumbnail and post header with a blur placeholder, and is the post's OG/Twitter share image.
      For a post with no `cover`, the satori fallback still yields a share card whose `og:image`
      path returns `200` `image/png`. This post ships with a real (or stock) cover, generated only
      if neither is available.
- [ ] The in-body Zombie Horde image renders via `next/image` with a blur placeholder, EXIF-
      scrubbed, with alt text - and is not used as the cover.
- [ ] Statically generated: `generateStaticParams` enumerates `content/blog/`; no runtime fetch.
- [ ] Responsive from ~320px up (listing rows and post body reflow, no horizontal overflow); light
      and dark both read cleanly (tokens only).
- [ ] `src/lib/blog` has unit coverage (frontmatter parse, required-field failure, newest-first
      sort). The `/blog` and `/blog/[slug]` smoke asserts route-unique post copy + placeholder
      absent + the OG image `200`.
- [ ] `npm run lint`, `npm run build`, and `npm test` pass.
- [ ] `features.md` `/blog` and `/blog/[slug]` rows updated from placeholder to live.

## Notes

- Voice/palette references: `docs/design/brand-guide.md`. Content rules: `docs/rules/` (ASCII-only,
  spaced hyphens, straight quotes).
- New dependency (MDX compiler, possibly `gray-matter`) => the **security** and **architect**
  personas are in scope at review (new dep + a new data-flow/boundary), alongside **engineer** and
  **tester**.
- Public-repo rule: the post and any `public/images/blog/` art must be PII-free (no location finer
  than region, no contact info), same guard as the resume/contact specs.
