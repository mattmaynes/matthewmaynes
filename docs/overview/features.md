# Features

What the product does. Status: ✅ live · 🚧 placeholder · 📋 planned.

## Pages & routes

| Route | Status | Purpose |
|---|---|---|
| `/` | ✅ | Home. Hero (name, title, tagline, nature photo) with primary **About me** + secondary **Blog** CTAs, a short bio, an "Around the site" card grid, and a **Latest post** highlight via the shared `PostRow` (omitted when there are no posts). |
| `/about` | ✅ | First-person "whole person" story: how Matthew works, a leadership belief, and a personal "Beyond the Code" section (acreage + reforestation, family, dog, hobbies). |
| `/resume` | ✅ | Professional resume rendered from structured, scrubbed data, with a **download PDF** button serving an in-sync, contact-free PDF. |
| `/projects` | ✅ | Curated showcase (spec 0031) in three fixed sections - **Work → Tinkering → Making** - each a responsive grid of uniform cards (cover, title, tagline, tag badges). Sourced from `content/projects/*.mdx`; in the nav + sitemap. |
| `/projects/[slug]` | ✅ | Per-project detail page: story, imagery, tags, and cross-links, statically generated from the project MDX. |
| `/blog` | ✅ | Listing, newest-first from `content/blog/*.mdx`: each row a cover thumb, title, date, reading-time pill, excerpt, tags, and a series pill. Discovery (spec 0012): a URL-synced (`?tag=`) Canopy `Combobox` tag filter, keyword search, and a date-gated "New" badge. A subscribe block sits at the bottom. |
| `/blog/[slug]` | ✅ | Individual post (MDX + frontmatter, statically generated): breadcrumb, header (title, byline + avatar, date + reading-time pill, tag-archive links), cover hero (with a series sash when the post is in a series), the MDX body at an 18px measure with blur-placeholder inline images and self-hosted video, a disclaimer, a subscribe block, previous/next nav, and a "Back to blog" link. The cover doubles as the per-post OG/Twitter card. |
| `/blog/tags/[tag]` | ✅ | Statically generated archive per tag (spec 0027): every post with that tag, same row treatment as `/blog`, route-unique title/description, listed in the sitemap. Unknown slug → 404. |
| `/blog/drafts` + `/blog/drafts/[slug]` | ✅ | Preview area (spec 0034/0035): the not-yet-public set - drafts (`draft: true`) **and** scheduled posts (a future `publishAt`) - `noindex`, not in any nav/sitemap, with an empty state when there are none. **Gate (spec 0036, feedback 0022):** the INDEX is behind `/login` (a shared password; don't leak the list). Each `[slug]` page serves its OG card publicly so links **unfurl**, but gates the readable body - logged out shows a teaser + "Log in to read"; logged in renders the full `PostArticle` with a "Draft" or "Scheduled for ..." banner. Removing `draft: true` publishes on the next build; a scheduled post publishes on its own once `publishAt` passes. |
| `/login` + `/v1/login` + `/v1/logout` | ✅ | Preview gate (spec 0036): a styled password screen; `POST /v1/login` verifies the shared `PREVIEW_PASSWORD` (reusing the shared spam guards), sets a stateless HMAC session cookie, and redirects back; `/v1/logout` clears it. `noindex`. |
| `/contact` | ✅ | Working contact form (spec 0008/0032): emails an on-brand HTML notification via `POST /v1/contact` and records the sender in Constant Contact (unsubscribed by default; an opt-in checkbox adds them to the list). A column of icon + URL-path social links. No email/phone shown. |
| `/subscribe` | ✅ | Shareable mailing-list landing page (spec 0018): heading + invitation, the full subscribe form, a latest-post card, and a link to `/blog`. Not in the nav, but in the sitemap. |
| `/privacy` | ✅ | Plain-language privacy policy (spec 0017): PostHog analytics with masked replay, the Resend contact form, transient IP use, no cookies/ads/database. Cookieless legitimate-interest basis. Lists the only email on the site (`privacy@`). Footer link. |
| `/ai-policy` | ✅ | Plain-language AI transparency page (spec 0030): AI is used only as an editor/sounding board; ideas and opinions stay the author's. Names no tools. Footer link. |

## Navigation & global behavior

- **Top nav:** Home · About · Resume · Projects · Blog · Contact (Canopy `TopNav`; hamburger on
  mobile). `/subscribe`, `/privacy`, `/ai-policy` are footer/shared-only. **Footer:** the five social
  links as icon-only ghost buttons + `Privacy` / `AI Policy`. All icons come from `@rogueoak/icons`
  (no hand-rolled SVGs, spec 0007).
- **Responsive** from small phones up; **theme** (light/dark on Harbor) defaults to OS preference with
  a header toggle persisted in `localStorage`, applied before first paint (no flash).
- **SEO & sharing** (spec 0004): generated favicon set, OG + Twitter `summary_large_image` cards from
  a 1200x630 branded image, `robots.txt`, `sitemap.xml` (from `nav` + posts + tag archives), a web
  manifest, and a JSON-LD `Person`.
- **Analytics** (spec 0014): PostHog (US Cloud) for analytics, masked-input session replay, and error
  tracking (client boundaries self-heal a stale-deploy `ChunkLoadError`; server via
  `instrumentation.ts`). Proxied same-origin through `/ingest/*`. No consent banner (cookieless). The
  contact/subscribe forms fire PII-free conversion events. **Only the deployed production host
  captures** (spec 0016) - local runs send nothing.

## Blog

- Posts are `.mdx` files (filename → slug). Frontmatter: `title`, `date`, `tags`, `excerpt`, optional
  `cover`/`coverCaption`, optional `series` (e.g. "Life Log" - renders a corner **sash** on the hero
  and a pill on rows), optional `draft: true` (spec 0034; absent = published), and optional
  `publishAt` (spec 0035; an ISO 8601 time to auto-publish at - a bare datetime is read as UTC).
- Body is prose + known components only: `<PostImage>` (static-imported, blur placeholder, a
  `pixelated` flag) and `<PostVideo>` (self-hosted, browser-safe H.264 with a poster, from the
  `blog-videos` registry). Both fail the build loudly on an unknown name.
- Reading chrome (spec 0011): a reading-time estimate (`estimateReadingMinutes`, ~200 wpm, markup
  stripped), byline + avatar, disclaimer, and the 18px body measure. Previous/next post nav (spec
  0021) as OG-style tiles.
- Listing discovery (spec 0012) is a `"use client"` island over a Server Component page: tag
  `Combobox` + keyword search + "New" badge, with the active tag mirrored in `?tag=` via
  `history.replaceState` + `useSyncExternalStore` (keeps the page statically generated).
- Tag archives (spec 0027), an RSS 2.0 feed at `/blog/feed.xml` (spec 0013, from the pure `rss.js`
  builder), and the preview area (spec 0034/0035) all enumerate `getPublishedPosts()` so a draft or a
  not-yet-due scheduled post never leaks onto a public surface. `getPublishedPosts(now)` is
  **time-aware** (spec 0035) and every public surface sets `revalidate = 60`, so a scheduled post
  flips live on its own within ~a minute of `publishAt` - no deploy. Announcement emails live in
  `emails/blog/<slug>.html` (filled from
  `emails/templates/`, published via the `ctct` CLI).

## Projects (spec 0031)

- Three fixed sections (**Work → Tinkering → Making**), a Server Component fully in the SSG HTML.
  Cards are uniform: photo covers `object-cover`; first-party logo SVGs `object-contain` on a neutral
  panel (served `unoptimized`). Order is manual (`order` frontmatter). Detail pages at
  `/projects/[slug]`.
- Content is a lightweight carve-out (like blog posts): a new `content/projects/<slug>.mdx` adds a
  card next build (a brand-new raster cover also needs a one-line import in
  `src/lib/project-images.ts`) - Canadian English, no PII (covers EXIF-scrubbed; location no finer
  than region), shipped via an approved PR. The pipeline under `src/` stays a full-Spectra feature.

## Resume

- Rendered from a structured, scrubbed source (`src/lib/resume.ts`): **no** phone/email/exact address
  (location no finer than "Ontario, Canada"). Public professional links only.
- `/resume.pdf` is a **committed artifact** rendered from the page by headless Chrome with `@media
  print` styles (always contact-free, always in sync), regenerated by `npm run resume:pdf` only when
  the sources change; CI fails on a stale hash. See `architecture.md`.

## Contact & subscribe (specs 0008, 0018, 0032)

- Both are thin versioned routes (`POST /v1/contact`, `POST /v1/subscribe`) over pure, fs-free cores,
  sharing one layered spam-guard set (`http-guards.js`: honeypot, validation + length caps, per-IP
  rate limit, same-origin). Secrets are server-env-only, never in the bundle or repo.
- **Contact** relays an on-brand HTML notification via Resend and records the sender in Constant
  Contact (unsubscribed by default; an opt-in checkbox subscribes instead). **Subscribe** adds the
  email to the CTCT blog list via the create-or-update `sign_up_form` endpoint (idempotent), with an
  optional revealed name field and an in-place "You are on the list" confirmation. Both surfaces are
  `ph-no-capture` and fire PII-free conversion events.

## Images

Metadata-scrubbed photos in `public/images/`, served via `next/image`, static-imported (through
`src/lib/site.ts`, `blog-images.ts`, or `project-images.ts`) so each gets a build-time `blurDataURL`
and renders with `placeholder="blur"`. Photos are JPEG (sRGB, EXIF/GPS stripped, right-sized);
flat graphics stay PNG. Optimized to WebP, content-hashed, returned `immutable`; a CD `prewarm` job
(`scripts/prewarm-images.ts`) warms the optimizer cache after each deploy (spec 0006). Self-hosted
blog video lives under `public/videos/blog/` (see `blog-videos.ts`).
