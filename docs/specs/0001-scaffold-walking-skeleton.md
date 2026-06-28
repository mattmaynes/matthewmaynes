# 0001 — Scaffold the walking skeleton

## Problem

There is no application yet — only planning docs and the Harbor palette in `src/styles/`. We need
a runnable foundation: a Next.js app with every page in the site map present (as placeholders),
themed with Harbor, that builds and runs locally in a container. This is the base every later
feature builds on.

## Outcome

When done, a developer can:

- Run `npm run dev` and visit all routes: `/`, `/about`, `/resume`, `/projects`, `/blog`,
  `/blog/[slug]`, `/contact`. Each renders a titled placeholder within a shared layout (header
  nav + footer).
- See the **Harbor** theme applied (colors, fonts) and toggle dark mode.
- Build the production bundle (`npm run build`) and run it via the Node standalone server.
- Run the whole thing in Docker: `docker compose up` serves the site on `http://localhost:3000`.

## Scope

**In**

- `create-next-app` (App Router, TypeScript, Tailwind v4, ESLint), integrating the existing
  `src/styles/globals.css` + `theme-harbor.css` (do not regenerate or overwrite them).
- Install + wire `@rogueoak/roots`, `@rogueoak/canopy`, fontsource fonts.
- Root layout: shared `Header` (nav: Home · About · Resume · Projects · Blog · Contact, mobile
  hamburger) and `Footer` (LinkedIn + GitHub links, copyright, "Built by Matthew Maynes").
- **Theme toggle.** Light/dark via Roots' `.dark` class. Default to the OS setting
  (`prefers-color-scheme`); when the user toggles, persist the choice in `localStorage` and let it
  win over the system setting thereafter. Apply the resolved theme **before first paint** (small
  inline script in `<head>`) so there is no flash of the wrong theme on load. Respect later changes
  to the system setting only while the user has not made an explicit choice.
- **Mobile responsive.** Every page and the layout work from small phones up; the nav collapses to
  the hamburger, images scale, no horizontal overflow. This is a baseline acceptance criterion, not
  a later pass.
- Placeholder page per route, each using Canopy/Harbor primitives so the theme is visibly applied.
  `/blog` lists nothing yet; `/blog/[slug]` renders a placeholder for any slug.
- **Real images wired in** (see *Assets* below) via `next/image`, even though surrounding copy
  stays placeholder.
- `next.config` with `output: 'standalone'`; `SITE_URL` plumbed.
- Multi-stage `Dockerfile` (deps → build → runtime on `node:20-alpine`) + `.dockerignore` +
  `docker-compose.yml` (maps `3000:3000`).
- `README.md` with local dev + Docker run instructions.
- A minimal smoke test that asserts each route returns 200 / renders its heading.

**Out** (later specs)

- Real body copy/narrative, OG images, favicon. (Photos/headshot are now **in** — see *Assets*.)
- Real resume content + PDF generation (own spec; uses the print-stylesheet approach).
- Working contact form / server-side mail + spam protection (own spec).
- MDX pipeline, real blog posts, project data, tag filtering.
- CI/CD and the actual DigitalOcean deploy.

## Approach

- Scaffold in a worktree; **preserve** `src/styles/*` and fold them into the generated app's
  global stylesheet rather than letting the generator clobber them.
- Keep placeholders honest: a small shared `<PagePlaceholder title=… note=…/>` so it's obvious
  each page is a stub, while still exercising layout + theme + typography tokens.
- Standalone output now so the contact-form spec has a server to attach to.
- **Privacy:** no real email/phone/address anywhere. Footer/contact use LinkedIn + GitHub only;
  the contact route is a visual placeholder (no live endpoint yet). `.env*` git-ignored; document
  `SITE_URL` in `.env.example` with no secrets.
- **Theme:** an inline pre-paint script reads `localStorage.theme`; if unset, falls back to
  `matchMedia('(prefers-color-scheme: dark)')`, and sets/removes `.dark` on `<html>` accordingly.
  The toggle writes `localStorage.theme = 'light' | 'dark'`. A `matchMedia` listener updates the
  theme on OS change only when no stored choice exists. Keep it small and dependency-free.

### Assets

Six metadata-scrubbed PNGs are staged in `/assets` (all EXIF/GPS already stripped). The scaffold
moves them to `public/images/` and serves them through `next/image` (which handles resize +
WebP/AVIF delivery, so the heavy source PNGs are never shipped to the browser). Initial placement,
with placeholder copy around them:

| Image | Page | Use |
|---|---|---|
| `area-i-live.png` | `/` Home | Hero background (nature photo from the property) |
| `headshot.png` | `/` Home, `/about`, `/resume` | Portrait / professional headshot |
| `family.png` | `/about` | "Beyond the Code" personal section |
| `sasha-best-dog-ever.png` | `/about` | Personal section (dog) |
| `baby-matthew.png` | `/about` | Personal section (early life) |
| `eagle-snap.png` | `/projects` | Eagle SNAP project card |

All images use descriptive `alt` text and explicit dimensions to avoid layout shift. The raw PNGs
are large (~18MB total); optional downscaling/optimization is a follow-up, not a blocker.

## Acceptance

- [ ] `npm run dev` serves all 7 route patterns; each shows a placeholder in the shared layout.
- [ ] Harbor theme visibly applied.
- [ ] **Theme:** first load matches the OS setting with no flash; toggling persists across reloads
      via `localStorage` and overrides the system setting.
- [ ] **Responsive:** layouts work from ~320px up; nav collapses to a hamburger; no horizontal
      overflow; images scale.
- [ ] The six PNGs render via `next/image` on their mapped pages with meaningful `alt` text.
- [ ] `npm run build` succeeds with `output: 'standalone'`.
- [ ] `docker compose up` serves the site at `http://localhost:3000`; image < 200MB.
- [ ] `npm run lint` is clean; smoke test passes; ASCII-only source per Trellis.
- [ ] No real email, phone, or full address in any tracked file; no GPS/EXIF in shipped images;
      `.env*` ignored.
- [ ] `README.md` documents local dev + Docker.

## Notes

- Existing `src/styles/globals.css` + `theme-harbor.css` are authoritative for theming.
- Design reference: `docs/design/brand-guide.md`. Living docs: `docs/overview/`.
