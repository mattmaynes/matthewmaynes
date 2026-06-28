# matthewmaynes.com

Personal website for Matthew Maynes - portfolio, resume, blog, and contact. This is the
**walking skeleton**: every route in the site map exists as a themed placeholder within a shared
layout. Structure, the Harbor theme, dark mode, and the real photos are wired up; the prose is
placeholder until later specs fill it in.

## Stack

- **Next.js** (App Router) + **TypeScript**, served as a **Node standalone** build
  (`output: 'standalone'`).
- **Tailwind CSS v4** (CSS-first) on the **Harbor** theme - `@rogueoak/roots` design tokens with a
  site override in `src/styles/theme-harbor.css`.
- **Canopy** (`@rogueoak/canopy`) components (Button, Card, Badge, FormField, Input, Textarea).
- Self-hosted fonts via `@fontsource-variable/figtree` (UI/body) and
  `@fontsource-variable/geist-mono` (code).

## Local development

```bash
npm install
npm run dev
```

Visit http://localhost:3000. Routes: `/`, `/about`, `/resume`, `/projects`, `/blog`,
`/blog/<any-slug>`, `/contact`.

### Theme

Light/dark is driven by Roots' `.dark` class on `<html>`. It defaults to your OS setting
(`prefers-color-scheme`); the header toggle overrides it and the choice is persisted in
`localStorage` (key `theme`), winning over the system setting thereafter. A pre-paint inline script
applies the resolved theme before first paint, so there is no flash of the wrong theme.

## Scripts

| Command         | What it does                                                        |
| --------------- | ------------------------------------------------------------------- |
| `npm run dev`   | Start the dev server.                                               |
| `npm run build` | Production build (standalone output).                               |
| `npm start`     | Run a non-standalone production server (`next start`).              |
| `npm run lint`  | ESLint.                                                             |
| `npm test`      | Boot the standalone server and smoke-test every route returns 200. |

## Production build

```bash
npm run build
node .next/standalone/server.js   # serves on PORT (default 3000), HOSTNAME 0.0.0.0
```

The standalone build emits `.next/standalone/server.js`. The runtime also needs `.next/static` and
`public/` copied alongside it (the Dockerfile does this).

## Docker

Multi-stage build (deps -> build -> runtime on `node:20-alpine`) serving the standalone output.

```bash
docker compose up --build
```

The site is served on http://localhost:3000. Equivalent manual commands:

```bash
docker build -t mm-site .
docker run --rm -p 3000:3000 mm-site
```

## Configuration

Environment variables (see `.env.example` - copy to `.env.local` for local overrides):

| Variable   | Purpose                                              |
| ---------- | ---------------------------------------------------- |
| `SITE_URL` | Canonical origin for metadata/absolute URLs.         |
| `NODE_ENV` | `development` \| `production` \| `test`.             |

No secrets live in the repo. `.env*` is git-ignored except `.env.example`.

## Project layout

```
src/
  app/         App Router routes (layout + one page per route)
  components/  Header, Footer, ThemeToggle, ThemeScript, PagePlaceholder, ui (Canopy boundary)
  lib/         site config (identity, nav, social, image metadata)
  styles/      globals.css + theme-harbor.css (authoritative Harbor theme)
public/images/ site photography
tests/         route smoke test
```

## Notes

- The contact form is a **visual placeholder** in this build - it does not submit anywhere. A
  server-side handler is a later spec.
- No real email, phone, or street address appears anywhere; location is given only as
  "Ontario, Canada".
