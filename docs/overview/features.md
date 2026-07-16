# Features

What the product does. Status legend: ✅ live · 🚧 placeholder (route exists, real content
pending) · 📋 planned.

## Pages & routes

| Route | Status | Purpose |
|---|---|---|
| `/` | 🚧 | Home. Hero (name, title, tagline, nature photo) with two CTAs - a primary **About me** and a secondary **Blog** button (spec 0029) - a short blended bio, an "Around the site" card grid (About/Resume/Blog/Contact), and a **Latest post** highlight that surfaces the single newest post through the shared `PostRow` (cover, title, date, reading-time pill, excerpt, tags, "New" badge) with a "See all posts" link to `/blog` (spec 0029; omitted when there are no posts). |
| `/about` | ✅ | The "whole person" story in first person: how Matthew works (problem solver, leader who still builds), a leadership belief, and a personal "Beyond the Code" section (5 acres + reforestation, family, dog, hobbies). |
| `/resume` | ✅ | Detailed professional resume rendered from structured data, with a **download PDF** button serving an in-sync, contact-free PDF. |
| `/projects` | 🚧 | Card grid of notable work, sourced from data files. **Unlisted** while in progress: the route exists but is not linked from the nav, home page, or sitemap. |
| `/blog` | ✅ | Blog listing, newest-first from `content/blog/*.mdx`: each row a cover thumbnail, title, formatted date, a reading-time pill (spec 0015, the same `Clock` + "N min read" treatment as the post page), excerpt, and tag labels. Interactive discovery (spec 0012): a single-select Canopy `Combobox` tag filter (URL-synced `?tag=`), a keyword search over title/excerpt/tags, and a date-gated "New" badge on the newest post. Drop in a `.mdx` file to list a new post. An email "Subscribe for updates" block (spec 0018) sits at the bottom. |
| `/blog/[slug]` | ✅ | Individual post, authored as MDX with frontmatter (statically generated). Renders a `Blog / {title}` breadcrumb trail at the top (spec 0022, Canopy's `Breadcrumb` Twig set) so the listing is one click away, then a header (title; a "By Matthew Maynes" byline with the headshot avatar; a date + a `Clock` reading-time pill; tags, each pill a link to its tag archive - spec 0027), a cover image, the MDX body at a comfortable 18px (`text-body-lg`, a site semantic type role) reading measure with Harbor prose styling and blur-placeholder inline images, a "thoughts and views are my own" disclaimer, an email "Subscribe for updates" block (spec 0018), previous/next post navigation to the chronological neighbours (spec 0021, older post left / newer post right; stacked next-first on mobile; each tile carries a reading-time pill + tags), and a "Back to blog" link. Its cover doubles as a per-post Open Graph / Twitter share card. |
| `/blog/tags/[tag]` | ✅ | A statically generated archive per tag (spec 0027): every post carrying that tag, newest-first, rendered with the same row treatment as `/blog`, under a "Posts tagged {Tag}" heading with an "All posts" link back and a subscribe block. One page per tag (including single-post tags; a future tag gets a page on the next build); an unknown tag slug is a clean 404. A route-unique `<title>`/description makes each an indexable landing page; every archive is listed in the sitemap. The post-page tag pills link here, and the `/blog` tag Combobox remains the in-place browse surface. |
| `/blog/drafts` | ✅ | The drafts index (spec 0034): lists every unpublished post (`draft: true` frontmatter), newest-first with the same row treatment as `/blog`, each row linking to `/blog/drafts/[slug]`. Deliberately `noindex` and **not** linked from any nav or the sitemap - reachable only by knowing the URL. Empty when there are no drafts. |
| `/blog/drafts/[slug]` | ✅ | An individual draft post (spec 0034), statically generated and rendered identically to a published post via the shared `PostArticle` (so it previews exactly as it will publish), plus a visible "Draft" marker banner and a `Blog / Drafts / {title}` breadcrumb. `noindex`; no subscribe block. Removing `draft: true` moves the post to `/blog/[slug]` on the next build. A published slug 404s here, and a draft slug 404s at `/blog/[slug]`. |
| `/contact` | ✅ | A working contact form (full-width, first on the page) that emails Matthew an on-brand HTML notification via `POST /v1/contact` and records the sender in Constant Contact (unsubscribed by default; an opt-in "Subscribe for updates from me" checkbox also adds them to the mailing list - spec 0032), plus a column of icon + URL-path social links (LinkedIn, X, Facebook, Instagram). No email/phone shown. |
| `/subscribe` | ✅ | A focused, shareable mailing-list landing page (spec 0018): a heading + short invitation, the subscribe form with all three fields (email, name, button) shown up front, then a "Latest post" card (newest post, with its tags) and a "See all posts" button to `/blog`. **Not** in the top nav (the shared nav/footer still render), but it **is** in the sitemap so the URL is crawlable when shared. |
| `/privacy` | ✅ | Plain-language privacy policy (spec 0017) documenting what the site actually does: PostHog analytics with masked-input session replay, the Resend-relayed contact form, transient IP use, self-hosted assets, no tracking cookies/ads/database. Cookieless legitimate-interest basis (no consent banner). Linked from the footer, not the top nav or sitemap. Lists a dedicated public `privacy@` address for data requests - the only email on the site. |
| `/ai-policy` | ✅ | Plain-language AI transparency page (spec 0030): first-person prose stating that AI is used only as an editor and sounding board (structure, wording, catching mistakes) while the ideas, opinions, and experiences stay the author's. Warmer `<h1>` ("How I Use AI") with an "AI Policy" `<title>`/footer label. Principle-based, names no tools. Footer utility like `/privacy` - not in the top nav or sitemap. |

## Navigation

- Top bar: Home · About · Resume · Blog · Contact, built on Canopy's `TopNav` Branch
  (mobile: a left-aligned hamburger that opens Canopy's disclosure panel). Projects is intentionally
  omitted while it is an in-progress stub - the `/projects` route still exists and is reachable
  directly, but it is not linked from the nav, the home page, or the sitemap until it ships.
  `/subscribe` (spec 0018) is likewise kept out of the nav, but - unlike `/projects` - it *is* in
  the sitemap, since it is a landing page meant to be shared and discovered.
- Footer: all five social links (LinkedIn, GitHub, X, Facebook, Instagram) as icon-only Canopy
  ghost-icon Buttons, plus the copyright and `Privacy` (`/privacy`, spec 0017) and `AI Policy` (`/ai-policy`, spec 0030)
  links. Icons come
  from `@rogueoak/icons` (the curated Canopy set), as does the header theme toggle's sun/moon - the
  site keeps no hand-rolled icon SVGs (spec 0007). (The contact page shows the same profiles instead
  as a labelled column - see below.)

## Global behaviors

- **Responsive** from small phones up: nav collapses to a hamburger, images scale, no horizontal
  overflow. A baseline, not a later polish pass.
- **Theme** (light/dark via the Harbor `.dark` layer): defaults to the OS `prefers-color-scheme`,
  with a header toggle whose choice persists in `localStorage` and then overrides the system
  setting. Applied before first paint, so no flash on load.
- **SEO & sharing** (spec 0004): the metal-M favicon set (`favicon.ico` + PNG `icon`/`apple-icon`
  + 192/512 manifest icons, all generated from `public/brand/logo-m.png` by
  `scripts/build-icons.ts`); Open Graph + Twitter `summary_large_image` cards backed by a
  generated 1200x630 branded share image (`app/opengraph-image.tsx`, reused for `twitter-image`);
  `robots.txt`, `sitemap.xml` (from the `nav` source), a web manifest, `theme-color`, and a JSON-LD
  `Person` block. One link, a rich preview everywhere it is pasted.
- **Analytics & observability** (spec 0014): PostHog (US Cloud) captures product **analytics**
  (pageviews on every App Router route change, page-leave, and autocapture), **session replay**
  (with all form inputs masked - the contact form is additionally marked `ph-no-capture`, so a
  visitor's typed message is never recorded), and **error tracking** for both client exceptions
  (autocapture + `error`/`global-error` boundaries, which also self-heal a stale-deploy
  `ChunkLoadError` with a guarded reload and re-apply the visitor's theme) and server exceptions (`instrumentation.ts`
  `onRequestError` via posthog-node, covering `POST /v1/contact`). All traffic is proxied
  same-origin through `/ingest/*`, so tracker blockers and a future CSP need no third-party
  exception. No consent banner: analytics run for all visitors in cookieless mode. The contact
  form also fires explicit, PII-free conversion events (submitted/succeeded/failed) so the site's
  one conversion stays measurable despite the replay mask. **Only the deployed production host
  captures** (spec 0016): local runs (`next dev` or a local production build on localhost) init and
  send nothing, so developer traffic never reaches the live dashboard. (Logs via OpenTelemetry are a
  separate follow-up, a later spec.)

## Images

Six metadata-scrubbed images in `public/images/`, served via `next/image`: `area-i-live` (home hero
nature shot), `headshot` (portrait), `family` / `sasha-best-dog-ever` / `baby-matthew` (about
"Beyond the Code"), `eagle-snap` (projects). The five photos are JPEG (right format for
photographs, hero capped at 1600px); the `eagle-snap` banner is a flat graphic and stays PNG. All
EXIF/GPS stripped — no location leaks. They are static-imported through the `images` map in
`src/lib/site.ts`, so each gets a build-time `blurDataURL` (rendered with `placeholder="blur"` — no
pop-in flicker) and is optimized to WebP (`images.formats` in `next.config.ts`, with a long
`minimumCacheTTL`); above-the-fold images use `priority`. WebP-only (not AVIF) keeps first-paint
encode fast for the first visitor after each deploy (feedback 0006). Optimized images are
content-hashed and returned `immutable` with a ~10-year `max-age`, so browsers cache them
indefinitely and a changed image busts its own URL. To spare even the first post-deploy visitor the
on-demand encode, a CD `prewarm` job (`npm run prewarm`, `scripts/prewarm-images.ts`) crawls the
image-bearing pages and pre-requests every `/_next/image` variant so the optimizer cache is hot
before any real visit (spec 0006).

## Resume page

- Rendered from a structured, scrubbed source (`src/lib/resume.ts`). **Excludes** phone, email,
  and full postal address - location is shown no more specifically than region ("Ontario, Canada").
  Public professional links (the personal site matthewmaynes.com, LinkedIn, GitHub) are shown, each
  with a glyph from `@rogueoak/icons` (a generic `Globe` for the website).
- PDF download (`/resume.pdf`) is rendered from the page itself by headless Chrome with the
  `@media print` styles, so it is always contact-free and in sync with the page. The PDF is a
  committed artifact, regenerated by `npm run resume:pdf` only when the resume sources change; CI
  fails (via a hash check, no browser) if it is stale. See `architecture.md`.
- Content scope: summary, leadership principles, skills, tooling, full work history,
  certifications, education. (Private master lives in the git-ignored `context/resume.md`.)

## Projects (initial set to feature)

Eagle SNAP (iOS SNOWTAM app) · Visual Data Transformer (no-code ETL) · Streaming Data Engine
(kdb+/q) · Engineering Platform (Constant Contact) · This Website (meta).

## Blog

- Posts as `.mdx` files; filename → slug. Frontmatter: `title`, `date`, `tags`, `excerpt`, an
  optional `cover`/`coverCaption`, and an optional `draft: true` (spec 0034; absent = published).
- Tag groups: Technical · Leadership · Nature · Life. Newest first.
- Reading-experience chrome (spec 0011) lives on the post page: a reading-time estimate
  (`estimateReadingMinutes` in the pure `blog.js` core, ~200 wpm, floored at 1 minute, markup
  stripped so markdown/JSX is not counted), a byline + avatar, a personal-opinion disclaimer, and
  the larger 18px body measure (the `text-body-lg` site type role).
- Previous/next post navigation (spec 0021): the bottom of each post links to its chronological
  neighbours as OG-style tiles (cover thumbnail + direction label + title, plus a reading-time pill
  and the post's tags as badges under the title). Adjacency is the pure
  `getAdjacentPosts(posts, slug)` in `blog.js` (older = `previous`, newer = `next`; `null` at a
  boundary), so a boundary post shows only one tile. The presentational `PostNav` renders older on
  the left / newer on the right at `sm+`, and stacks them next-first on mobile.
- Listing discovery (spec 0012): a `"use client"` island (`src/components/blog-list.tsx`) renders
  the rows and owns tag filtering - a single-select Canopy `Combobox` (an "All posts" entry
  clears it), keyword search (title/excerpt/tags, case-insensitive), and the "New" badge. The page stays a Server Component: it resolves covers and computes each post's `isNew`
  flag server-side (newest post AND `isRecent(date, buildTime, 30)`, pure helpers in `blog.js`) so the
  content is fully in the SSG HTML. The active tag is mirrored in the URL (`?tag=`) via
  `history.replaceState` and read back through a `useSyncExternalStore` seam, which keeps the page
  statically generated (unlike `useSearchParams`, which would force a client-render bailout).
- Tag archives (spec 0027): a statically generated `/blog/tags/[tag]` page per tag, so each topic is
  an indexable/shareable URL rather than only client-side `?tag=` filter state. `generateStaticParams`
  enumerates every tag from the posts (`deriveTags`); `dynamicParams = false` makes an unknown slug a
  404. The pure `tagSlug`/`tagFromSlug` (in the fs-free `blog-view.js`, sharing the one `slugify` that
  `blog.js` re-exports) map a tag to/from its URL slug. The listing row is a shared presentational
  `PostRow` (used by both the client island and this server page), and a `toPostRows` server mapper
  resolves covers + the global "New" badge for both surfaces. Post-page tag pills link to these
  archives; the sitemap lists every archive (and every post - previously the sitemap omitted posts).
- Drafts (spec 0034): a post with `draft: true` in its frontmatter is hidden from every public
  surface - the `/blog` listing, the home-page latest slot, `/subscribe`, the RSS feed, the sitemap,
  the tag pages, the "New" badge, and published post nav all enumerate `getPublishedPosts()` (drafts
  filtered out). Drafts instead live under `/blog/drafts` (an unlinked, `noindex` index) and
  `/blog/drafts/[slug]` (the post, `noindex`, with a "Draft" marker), both statically generated over
  `getDraftPosts()`. Reachable-by-URL, not secret (no auth). Publishing is one edit - remove
  `draft: true` and the post moves to `/blog/[slug]` on the next build with no file move. The
  published and draft post routes reject each other's slugs so a post is served from exactly one URL.
- RSS feed (spec 0013): a valid RSS 2.0 feed at `/blog/feed.xml`, statically generated
  (`dynamic = "force-static"`) from `getPublishedPosts`, listing every post newest-first with an absolute
  link, `pubDate`, and the escaped excerpt. An `Rss` subscribe button on `/blog` and `/blog/[slug]`
  links to it, and both surfaces advertise it via `<link rel="alternate" type="application/rss+xml">`
  autodiscovery. The feed XML is assembled by the pure, fs-free `src/lib/rss.js` builder
  (`escapeXml`, `toRfc822`, `buildBlogFeed`), so escaping and RFC-822 dates are unit-tested; output is
  deterministic (`lastBuildDate` = newest post's date, not `Date.now()`).

## Contact form

- ✅ Live (spec 0008; notification + CRM, spec 0032). The page leads with the form at full container
  width, then a column of social links (LinkedIn, X, Facebook, Instagram) rendered as icon + URL-path
  labels (the resume "Links" treatment via the shared `socialPath` helper). Submitting `POST`s JSON to
  the versioned route `/v1/contact`, which validates, applies spam guards, and relays the message by
  email via Resend - now as an **on-brand HTML notification** (Harbor header, sender name, `mailto:`
  email, the message with line breaks, a Reply button) rendered from
  `emails/templates/contact-notification.html` with every field HTML-escaped and injected server-side.
- The destination address lives only in server env (`CONTACT_TO_EMAIL`, with `RESEND_API_KEY` and
  `CONTACT_FROM_EMAIL`) and is never sent to the browser or committed. The visitor's address is the
  reply-to, so a reply reaches them.
- **Constant Contact record (spec 0032).** Every submission also records the sender in CTCT
  (best-effort, non-fatal): by default as an **`unsubscribed`** contact on the **"Website Contact"**
  list (a CRM trail, no implied consent). An **unchecked-by-default "Subscribe for updates from me"**
  checkbox under the Email field opts them in instead - added via `sign_up_form` to both the blog and
  Website Contact lists, exactly like the standalone subscribe form. Reuses the spec 0018 token cache;
  only contact scope is needed (no campaign scope). See `architecture.md`.
- Spam protection ships with it (not deferred): a honeypot field, server-side validation + length
  caps, a best-effort per-IP rate limit, and a same-origin check. A CAPTCHA/Turnstile is the next
  follow-up if bots get through. See `architecture.md`.

## Blog subscribe

- ✅ Live (spec 0018). A "Subscribe for updates" block (title + email input + Subscribe button)
  sits at the bottom of the `/blog` listing and immediately after the content on each
  `/blog/[slug]` post (after the disclaimer, before the Back/RSS row). A `"use client"` island
  (`src/components/subscribe-form.tsx`) `POST`s JSON to the versioned route `/v1/subscribe`, which
  validates, applies the same shared spam guards as the contact form, and adds the email to the
  "Matthew Maynes Blog" list in Constant Contact. The block is mobile-first: input and button stack
  full width below `sm` and go inline on one row at `sm+`.
- **Optional name capture (spec 0018).** The box stays as above by default; focusing the
  email reveals a single optional "Name" field between the email and the button. On `sm+` the row
  stays inline as it reveals: the email shortens (`sm:flex-[2]`) and the Name field slides in between
  it and the button, so the button does not jump - below `sm` the fields stack. The reveal is
  **animated**: the field grows horizontally on `sm+` (the button slides over) and vertically below
  `sm` (the button is pushed down), fast (~200ms) and eased, via `max-width`/`max-height` + opacity
  rather than a `display` toggle (which cannot transition); `prefers-reduced-motion` gets an instant
  reveal, and the collapsed field is out of the tab order / a11y tree until shown. Providing a name
  is optional; when given it is split on the first space (first token -> first name, remainder ->
  last name) and stored on the Constant Contact contact for later personalization. A PII-free
  `has_name` boolean rides the submit event (never the name itself).
- **Dedicated `/subscribe` page (spec 0018).** The same form island, with all three fields shown
  from first paint (`alwaysShowName`) and its built-in heading suppressed (`heading={false}`) so the
  page supplies its own H1 + invitation copy. Below the form it shows the latest post (cover, title,
  date, reading-time pill, excerpt, and tags) and a link to the full listing. Submits carry a
  `source: "subscribe_page"` analytics dimension (PII-free), so the three surfaces (listing, post,
  landing page) are attributable.
- The Constant Contact OAuth credentials live only in server env (`CTCT_CLIENT_ID`,
  `CTCT_REFRESH_TOKEN`, `CTCT_LIST_ID`) and never reach the browser or the repo. The route mints a
  24h access token from the non-rotating refresh token (cached in-memory across requests) and calls
  the create-or-update `sign_up_form` endpoint, so a repeat email is idempotent. See
  `architecture.md`.
- On success the fields + button are replaced in place by a compact, badge-shaped "You are on the
  list" confirmation (a check glyph + text in the success tokens, roughly the size of the Subscribe
  button; `role="status"` so it is announced), so the outcome reads at a glance and the form no
  longer invites a second submit (spec 0018). The badge animates in with a subtle fade + scale-up
  (~200ms ease-out, matching the name-field reveal; instant under `prefers-reduced-motion`).
- The submit is tracked as a PII-free conversion event (`blog_subscribe_*`); the form is
  `ph-no-capture`, so the address never enters autocapture or session replay.
- Spam guards are shared with the contact form: the honeypot, same-origin, and per-IP rate-limit
  helpers were extracted into `src/lib/http-guards.js`, which both `/v1/contact` and `/v1/subscribe`
  import. A CAPTCHA/Turnstile remains the follow-up if bots get through.

## Projects (spec 0031)

- **`/projects` is a curated showcase** of three fixed sections in a set order - **Work ->
  Tinkering -> Making** (professional-to-personal). Each section is a heading over a responsive grid
  (`sm:grid-cols-2 lg:grid-cols-3`) of uniform cards; an empty category renders nothing. The page is
  a Server Component, fully static in the SSG HTML (no client island, no filter - the three sections
  are the structure).
- **A card** shows a cover, title, one-line tagline, and tag badges (Canopy `Card` + `Badge`). Cards
  are uniform: photo/screenshot covers render `object-cover`; the first-party rogueoak logo SVGs
  render `object-contain` on a neutral panel (served `unoptimized`, so no `dangerouslyAllowSVG`).
  With an `href` the whole card is an external link (new tab, arrow affordance, sr-only new-tab hint);
  without one it is a plain card (a Phase 2 detail page will make it link internally instead).
- **Order is manual** (`order` frontmatter, ascending, unset last) so a section is curated rather
  than a date feed. `/projects` is in `nav` (header + sitemap) and has a **Projects card** in the
  home "Around the site" grid (Star icon).
- **Content is a lightweight carve-out** (like blog posts, `AGENTS.md`): a new
  `content/projects/<slug>.mdx` adds a card on the next build (a brand-new raster cover also needs a
  one-line static import in `src/lib/project-images.ts`, the single pipeline touch, mirroring
  `blog-images.ts`) - spell-checked Canadian English, no PII (covers are EXIF-scrubbed;
  **location no finer than region**, so builds are named by feature like "Back Deck", never by town),
  shipped via an approved PR. The pipeline/tooling under `src/` stays a full-Spectra feature.
- **Phase 2 (not yet built):** per-project detail pages (`/projects/[slug]`) with a story, an image
  gallery (the "before/after" pairs are staged for this), tag badges, and related-post/project
  cross-links. The frontmatter and card already reserve for it, so it is additive.
