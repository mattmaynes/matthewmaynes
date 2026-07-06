# Features

What the product does. Status legend: ✅ live · 🚧 placeholder (route exists, real content
pending) · 📋 planned.

## Pages & routes

| Route | Status | Purpose |
|---|---|---|
| `/` | 🚧 | Home. Hero (name, title, tagline, nature photo), short blended bio, featured projects, latest posts, social links. |
| `/about` | ✅ | The "whole person" story in first person: how Matthew works (problem solver, leader who still builds), a leadership belief, and a personal "Beyond the Code" section (5 acres + reforestation, family, dog, hobbies). |
| `/resume` | ✅ | Detailed professional resume rendered from structured data, with a **download PDF** button serving an in-sync, contact-free PDF. |
| `/projects` | 🚧 | Card grid of notable work, sourced from data files. **Unlisted** while in progress: the route exists but is not linked from the nav, home page, or sitemap. |
| `/blog` | ✅ | Blog listing, newest-first from `content/blog/*.mdx`: each row a cover thumbnail, title, formatted date, a reading-time pill (spec 0015, the same `Clock` + "N min read" treatment as the post page), excerpt, and tag labels. Interactive discovery (spec 0012): tag-chip filters (URL-synced `?tag=`), a keyword search over title/excerpt/tags, and a date-gated "New" badge on the newest post. Drop in a `.mdx` file to list a new post. An email "Subscribe for updates" block (spec 0018) sits at the bottom. |
| `/blog/[slug]` | ✅ | Individual post, authored as MDX with frontmatter (statically generated). Renders a header (title; a "By Matthew Maynes" byline with the headshot avatar; a date + a `Clock` reading-time pill; tags), a cover image, the MDX body at a comfortable 18px (`text-body-lg`, a site semantic type role) reading measure with Harbor prose styling and blur-placeholder inline images, a "thoughts and views are my own" disclaimer, an email "Subscribe for updates" block (spec 0018), and a "Back to blog" link. Its cover doubles as a per-post Open Graph / Twitter share card. |
| `/contact` | ✅ | A working contact form (full-width, first on the page) that emails Matthew via `POST /v1/contact`, plus a column of icon + URL-path social links (LinkedIn, X, Facebook, Instagram). No email/phone shown. |
| `/privacy` | ✅ | Plain-language privacy policy (spec 0017) documenting what the site actually does: PostHog analytics with masked-input session replay, the Resend-relayed contact form, transient IP use, self-hosted assets, no tracking cookies/ads/database. Cookieless legitimate-interest basis (no consent banner). Linked from the footer, not the top nav or sitemap. Lists a dedicated public `privacy@` address for data requests - the only email on the site. |

## Navigation

- Top bar: Home · About · Resume · Blog · Contact, built on Canopy's `TopNav` Branch
  (mobile: a left-aligned hamburger that opens Canopy's disclosure panel). Projects is intentionally
  omitted while it is an in-progress stub - the `/projects` route still exists and is reachable
  directly, but it is not linked from the nav, the home page, or the sitemap until it ships.
- Footer: all five social links (LinkedIn, GitHub, X, Facebook, Instagram) as icon-only Canopy
  ghost-icon Buttons, plus the copyright and a `Privacy` link to `/privacy` (spec 0017). Icons come
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
  `scripts/build-icons.mjs`); Open Graph + Twitter `summary_large_image` cards backed by a
  generated 1200x630 branded share image (`app/opengraph-image.tsx`, reused for `twitter-image`);
  `robots.txt`, `sitemap.xml` (from the `nav` source), a web manifest, `theme-color`, and a JSON-LD
  `Person` block. One link, a rich preview everywhere it is pasted.
- **Analytics & observability** (spec 0014): PostHog (US Cloud) captures product **analytics**
  (pageviews on every App Router route change, page-leave, and autocapture), **session replay**
  (with all form inputs masked - the contact form is additionally marked `ph-no-capture`, so a
  visitor's typed message is never recorded), and **error tracking** for both client exceptions
  (autocapture + a `global-error` boundary) and server exceptions (`instrumentation.ts`
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
on-demand encode, a CD `prewarm` job (`npm run prewarm`, `scripts/prewarm-images.mjs`) crawls the
image-bearing pages and pre-requests every `/_next/image` variant so the optimizer cache is hot
before any real visit (spec 0006).

## Resume page

- Rendered from a structured, scrubbed source (`src/lib/resume.ts`). **Excludes** phone, email,
  and full postal address - location is shown no more specifically than region ("Ontario, Canada").
  Public professional links (LinkedIn, GitHub) are shown.
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

- Posts as `.mdx` files; filename → slug. Frontmatter: `title`, `date`, `tags`, `excerpt`.
- Tag groups: Technical · Leadership · Nature · Life. Newest first.
- Reading-experience chrome (spec 0011) lives on the post page: a reading-time estimate
  (`estimateReadingMinutes` in the pure `blog.js` core, ~200 wpm, floored at 1 minute, markup
  stripped so markdown/JSX is not counted), a byline + avatar, a personal-opinion disclaimer, and
  the larger 18px body measure (the `text-body-lg` site type role).
- Listing discovery (spec 0012): a `"use client"` island (`src/components/blog-list.tsx`) renders the
  rows and owns tag-chip filtering, keyword search (title/excerpt/tags, case-insensitive), and the
  "New" badge. The page stays a Server Component: it resolves covers and computes each post's `isNew`
  flag server-side (newest post AND `isRecent(date, buildTime, 30)`, pure helpers in `blog.js`) so the
  content is fully in the SSG HTML. The active tag is mirrored in the URL (`?tag=`) via
  `history.replaceState` and read back through a `useSyncExternalStore` seam, which keeps the page
  statically generated (unlike `useSearchParams`, which would force a client-render bailout).
- RSS feed (spec 0013): a valid RSS 2.0 feed at `/blog/feed.xml`, statically generated
  (`dynamic = "force-static"`) from `getAllPosts`, listing every post newest-first with an absolute
  link, `pubDate`, and the escaped excerpt. An `Rss` subscribe button on `/blog` and `/blog/[slug]`
  links to it, and both surfaces advertise it via `<link rel="alternate" type="application/rss+xml">`
  autodiscovery. The feed XML is assembled by the pure, fs-free `src/lib/rss.js` builder
  (`escapeXml`, `toRfc822`, `buildBlogFeed`), so escaping and RFC-822 dates are unit-tested; output is
  deterministic (`lastBuildDate` = newest post's date, not `Date.now()`).

## Contact form

- ✅ Live (spec 0008). The page leads with the form at full container width, then a column of
  social links (LinkedIn, X, Facebook, Instagram) rendered as icon + URL-path labels (the resume
  "Links" treatment via the shared `socialPath` helper). Submitting `POST`s JSON to the
  versioned route `/v1/contact`, which validates, applies spam guards, and relays the message by
  email via Resend.
- The destination address lives only in server env (`CONTACT_TO_EMAIL`, with `RESEND_API_KEY` and
  `CONTACT_FROM_EMAIL`) and is never sent to the browser or committed. The visitor's address is the
  reply-to, so a reply reaches them.
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
- The Constant Contact OAuth credentials live only in server env (`CTCT_CLIENT_ID`,
  `CTCT_REFRESH_TOKEN`, `CTCT_LIST_ID`) and never reach the browser or the repo. The route mints a
  24h access token from the non-rotating refresh token (cached in-memory across requests) and calls
  the create-or-update `sign_up_form` endpoint, so a repeat email is idempotent. See
  `architecture.md`.
- The submit is tracked as a PII-free conversion event (`blog_subscribe_*`); the form is
  `ph-no-capture`, so the address never enters autocapture or session replay.
- Spam guards are shared with the contact form: the honeypot, same-origin, and per-IP rate-limit
  helpers were extracted into `src/lib/http-guards.js`, which both `/v1/contact` and `/v1/subscribe`
  import. A CAPTCHA/Turnstile remains the follow-up if bots get through.
