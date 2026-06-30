# Architecture

## Stack

- **Framework:** Next.js (App Router) + TypeScript.
- **Runtime:** Next.js **Node server** via `output: 'standalone'`. Chosen over a static export
  because the contact form needs a server-side endpoint to send mail; standalone keeps SSR / route
  handlers / dynamic OG available without re-architecting later.
- **Styling:** Tailwind CSS **v4** (CSS-first) on the **Harbor** theme — `@rogueoak/roots` tokens
  with a site override in `src/styles/theme-harbor.css`. See `docs/design/brand-guide.md`.
- **Fonts:** self-hosted via `@fontsource-variable/figtree` (UI/body) and
  `@fontsource-variable/geist-mono` (code), per Roots.
- **Blog:** MDX files with frontmatter; static generation at build time. Syntax highlighting via
  `rehype-pretty-code` + Shiki.
- **Content as data:** blog posts in `content/blog/*.mdx`, project data in `content/projects/`.
  No database, no runtime fetching.

## Styling layers (import order matters)

`globals.css` imports, in order: `tailwindcss` → `@rogueoak/roots/tokens.css` →
`@rogueoak/roots/tailwind-preset.css` → `./theme-harbor.css` (must win the cascade) → fontsource
packages. Components read **only** Roots' semantic tokens, so light/dark re-theme with no
per-component code. Already implemented in `src/styles/`.

## Deployment

- **Container:** multi-stage Dockerfile (deps → build → runtime). Runtime is `node:24-alpine`
  serving the standalone output. Target image well under 200MB.
- **Local:** `docker compose up` (or `npm run dev`). The root `docker-compose.yml` builds from
  source and maps `3000:3000`; it is for local use only.
- **Host:** a small Linux VM (about 512MB RAM) running two Compose stacks on a shared external
  `edge` network: **Caddy** (`deploy/docker/compose.proxy.yml` + `Caddyfile`) owns 80/443 and
  auto-provisions Let's Encrypt certs, reverse-proxying by hostname to the **site**
  (`deploy/docker/compose.site.yml`), which exposes 3000 only on `edge` (no host port). The
  routes-by-hostname topology is built for cohosting: a second site is one more `edge` service
  plus a Caddyfile block. The operator runbook is kept privately (git-ignored, not in the repo).
- **Images:** built off-host and pulled from GHCR (`ghcr.io/mattmaynes/matthewmaynes`, public), so
  the small server never runs a Next build. Tagged `latest` + immutable `sha-<commit>` for rollback.
- **CI/CD:** `.github/workflows/deploy.yml` - push to `main` runs verify (lint/build/test) →
  build+push to GHCR → SSH deploy to the server (`git pull`, `compose pull && up -d`). GHCR push
  uses the built-in `GITHUB_TOKEN`; the only repo secrets are the deploy SSH credentials.
- **Deploy layout:** all deploy artifacts live under `deploy/docker/`, leaving room for a future
  `deploy/helm/` or `deploy/terraform/` beside it.

## Configuration & secrets

- The repo is **public**. No secrets, PII, or real contact details in tracked files or history.
- Env vars: `NODE_ENV`, `SITE_URL` (`https://matthewmaynes.com`), and — for the contact form — a
  mail provider/SMTP credential and the destination address. All provided at runtime via the
  environment, never committed. `.env*` stays git-ignored.

## Repo layout (evolving — not prescriptive)

- `src/app/` — App Router routes and layouts.
- `src/components/` — UI and layout components.
- `src/lib/` — content loading (blog, projects).
- `src/styles/` — `globals.css` + `theme-harbor.css` (Harbor palette).
- `content/` — authored blog/project content (tracked; contains no PII).
- `public/` — static assets; generated `resume.pdf`.
- `context/` — **git-ignored** local planning notes and the private resume source.
- `docs/` — Spectra specs/plans/feedback/overview + `docs/design/` brand guide.

## Key decisions

- **Node server over static export** — to support the server-side contact form (and future
  dynamic needs) from day one.
- **Harbor on Roots** — bluer + slate palette with a warm accent, applied purely at the token
  layer so the design system stays intact and dark mode is free.
- **Resume privacy by construction** — the page and generated PDF are built from a source that
  omits phone/email/exact address; the real destination for the contact form lives only in server
  env vars.
