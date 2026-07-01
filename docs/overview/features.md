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
| `/blog` | ✅ | Blog listing, newest-first from `content/blog/*.mdx`: each row a cover thumbnail, title, formatted date, excerpt, and tag labels. Drop in a `.mdx` file to list a new post. (Tag *filtering* is a later spec.) |
| `/blog/[slug]` | ✅ | Individual post, authored as MDX with frontmatter (statically generated). Renders a header (title; a "By Matthew Maynes" byline with the headshot avatar; a date + a `Clock` reading-time pill; tags), a cover image, the MDX body at a comfortable 18px (`text-body-lg`, a Harbor semantic type role) reading measure with Harbor prose styling and blur-placeholder inline images, a "thoughts and views are my own" disclaimer, and a "Back to blog" link. Its cover doubles as a per-post Open Graph / Twitter share card. |
| `/contact` | ✅ | A working contact form (full-width, first on the page) that emails Matthew via `POST /v1/contact`, plus a column of icon + URL-path social links (LinkedIn, X, Facebook, Instagram). No email/phone shown. |

## Navigation

- Top bar: Home · About · Resume · Blog · Contact, built on Canopy's `TopNav` Branch
  (mobile: a left-aligned hamburger that opens Canopy's disclosure panel). Projects is intentionally
  omitted while it is an in-progress stub - the `/projects` route still exists and is reachable
  directly, but it is not linked from the nav, the home page, or the sitemap until it ships.
- Footer: all five social links (LinkedIn, GitHub, X, Facebook, Instagram) as icon-only Canopy
  ghost-icon Buttons, plus the copyright. Icons come from `@rogueoak/icons` (the curated Canopy
  set), as does the header theme toggle's sun/moon - the site keeps no hand-rolled icon SVGs
  (spec 0007). (The contact page shows the same profiles instead as a labelled column - see below.)

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
  the larger 18px body measure (the `text-body-lg` Harbor type role). The listing page is unchanged.

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
