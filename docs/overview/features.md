# Features

What the product does. Status legend: ✅ live · 🚧 placeholder (route exists, real content
pending) · 📋 planned.

## Pages & routes

| Route | Status | Purpose |
|---|---|---|
| `/` | 🚧 | Home. Hero (name, title, tagline, nature photo), short blended bio, featured projects, latest posts, social links. |
| `/about` | 🚧 | The "whole person" story — leadership philosophy + career narrative, and a personal "Beyond the Code" section (5 acres + reforestation, family, dog, hobbies). |
| `/resume` | 🚧 | Detailed professional resume rendered as a page (more depth than the PDF), with a **download PDF** button. |
| `/projects` | 🚧 | Card grid of notable work, sourced from data files. |
| `/blog` | 🚧 | Blog listing with previews (title, date, excerpt, tags) and tag filtering. |
| `/blog/[slug]` | 🚧 | Individual post, authored as MDX with frontmatter. |
| `/contact` | 🚧 | Social links (LinkedIn, GitHub) **and a contact form** that sends email server-side. No email/phone shown. |

## Navigation

- Top bar: Home · About · Resume · Projects · Blog · Contact (mobile: hamburger).
- Footer: social links (LinkedIn, GitHub), copyright.

## Global behaviors

- **Responsive** from small phones up: nav collapses to a hamburger, images scale, no horizontal
  overflow. A baseline, not a later polish pass.
- **Theme** (light/dark via the Harbor `.dark` layer): defaults to the OS `prefers-color-scheme`,
  with a header toggle whose choice persists in `localStorage` and then overrides the system
  setting. Applied before first paint, so no flash on load.

## Images

Six metadata-scrubbed PNGs in `public/images/`, served via `next/image`: `area-i-live` (home hero
nature shot), `headshot` (portrait), `family` / `sasha-best-dog-ever` / `baby-matthew` (about
"Beyond the Code"), `eagle-snap` (projects). All EXIF/GPS stripped — no location leaks.

## Resume page

- Rendered from a structured resume source. **Excludes** phone, email, and full postal address —
  location is shown no more specifically than region (e.g. "Ontario, Canada").
- PDF download is generated from the page itself (print stylesheet / build-time render) so it is
  always contact-free and in sync with the page.
- Content scope: leadership principles, skills, tooling, full work history, certifications,
  education. (Source narrative lives in the local, git-ignored `context/resume.md`.)

## Projects (initial set to feature)

Eagle SNAP (iOS SNOWTAM app) · Visual Data Transformer (no-code ETL) · Streaming Data Engine
(kdb+/q) · Engineering Platform (Constant Contact) · This Website (meta).

## Blog

- Posts as `.mdx` files; filename → slug. Frontmatter: `title`, `date`, `tags`, `excerpt`.
- Tag groups: Technical · Leadership · Nature · Life. Newest first.

## Contact form

- Posts to a server-side handler that relays the message by email. The destination address lives
  only in server env vars and is never sent to the browser. Needs spam protection (e.g. honeypot
  / rate limit) before it goes live — tracked as a follow-up, not part of the v1 scaffold.
