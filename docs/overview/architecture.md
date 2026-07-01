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
- **Blog (spec 0009):** MDX files with frontmatter, statically generated at build. A pure JS seam
  (`src/lib/blog.js`, unit-tested like `theme.js`/`contact.js`) hand-parses frontmatter (no
  `gray-matter`) for the cheap listing; `next-mdx-remote/rsc` `compileMDX` renders the body in a
  Server Component (`src/components/post-body.tsx`) over our own tracked files only. Post images are
  static-imported through `src/lib/blog-images.ts` (mirrors the `site.ts` map: blur placeholders,
  a `pixelated` flag for pixel art). Each post has a per-post satori OG card
  (`app/blog/[slug]/opengraph-image.tsx`, `generateStaticParams`-baked) that composes the cover.
  Syntax highlighting (`rehype-pretty-code` + Shiki) is planned but **not yet wired** - it lands
  with the first code-bearing post.
- **Content as data:** blog posts in `content/blog/*.mdx`, project data in `content/projects/`.
  No database, no runtime fetching.

## Metadata & sharing (spec 0004)

- **Next file conventions, not hand-rolled `<head>`:** `app/{favicon.ico,icon.png,apple-icon.png}`
  for icons; `app/opengraph-image.tsx` (+ a re-exporting `twitter-image.tsx`) for the share card;
  `app/{robots,sitemap,manifest}.ts` for the crawler/install surface. `layout.tsx` carries the
  default Open Graph / Twitter / robots metadata, a `viewport` `themeColor`, and a JSON-LD `Person`.
- **One source of truth:** identity/description/social come from `src/lib/site.ts`; sitemap routes
  come from its `nav`. Nothing is duplicated across the meta tags, sitemap, JSON-LD, and manifest.
- **Icons are generated, not hand-placed:** `scripts/build-icons.mjs` resizes the
  `public/brand/logo-m.png` master with macOS `sips` and packs the multi-res `favicon.ico` with a
  stdlib ICO writer - no ImageMagick, no npm dependency. Re-run it to refresh every size at once.
- **OG image asset loading:** satori (the `next/og` engine) cannot read the woff2 that
  `@fontsource-variable` ships, so the static `@fontsource/figtree` package (a pinned devDependency,
  which ships woff + its OFL license) is the source. `scripts/build-og-fonts.mjs` copies the woff +
  LICENSE into `src/app/_og/`, where `opengraph-image.tsx` loads them via
  `new URL(..., import.meta.url)` (traced into the standalone output). The card's headshot reads
  from `public/`, which the standalone/Docker copy step deploys next to `server.js`.

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
  build+push to GHCR → SSH deploy to the server (`git pull`, `compose pull && up -d`) → **prewarm**.
  GHCR push uses the built-in `GITHUB_TOKEN`; the only repo secrets are the deploy SSH credentials.
- **Image cache pre-warm (spec 0006):** the `prewarm` job runs after a healthy deploy and hits the
  live site (`node scripts/prewarm-images.mjs $SITE_URL`, via Caddy to the fresh container) to
  populate the on-demand `next/image` optimizer cache, so the first real visitor gets cache HITs
  instead of waiting on encodes. Best-effort: it only fails if the site is wholly unreachable.
  Browser-side caching needs no help - optimized images are content-hashed and returned
  `Cache-Control: public, max-age=315360000, immutable`, so repeat visits never re-fetch.
- **GHCR image retention (spec 0010):** each deploy pushes an image (tagged `latest` + `sha-<commit>`)
  plus, from the build's provenance attestation, two untagged child manifests - so the package grows
  by ~3 versions per deploy and would keep every build forever. `.github/workflows/cleanup-images.yml`
  runs daily (`schedule`) and keeps only the **10 most recent tagged images** and the manifests they
  reference, deleting older tagged images and orphaned untagged manifests. It uses the referrer-aware
  `dataaxiom/ghcr-cleanup-action` (`keep-n-tagged: 10`, pinned to a commit SHA, `packages: write`
  only), so an attestation child of a kept image is never orphaned and `latest` is always retained.
  `workflow_dispatch` runs a safe dry-run by default.
- **Deploy layout:** all deploy artifacts live under `deploy/docker/`, leaving room for a future
  `deploy/helm/` or `deploy/terraform/` beside it.

## Configuration & secrets

- The repo is **public**. No secrets, PII, or real contact details in tracked files or history.
- Env vars: `NODE_ENV`, `SITE_URL` (`https://matthewmaynes.com`), and — for the contact form
  (spec 0008) — `RESEND_API_KEY`, `CONTACT_TO_EMAIL` (the private destination), and
  `CONTACT_FROM_EMAIL` (verified-domain sender). All server-only (never `NEXT_PUBLIC_`), provided at
  runtime, never committed. `.env*` stays git-ignored; locally they live in `.env.local`.
- **Contact secrets on the host:** `deploy/docker/compose.site.yml` reads them via
  `env_file: [.env.site]` (`required: false`). The operator creates `deploy/docker/.env.site` once
  (`chmod 600`); it is git-ignored and untracked, so the deploy's `git reset --hard` (no `git clean`)
  leaves it in place across deploys. No new GitHub Actions secret is needed — the image is
  config-free and reads env at runtime.
- **PostHog key is build-time, not runtime (spec 0014).** `NEXT_PUBLIC_POSTHOG_KEY` /
  `NEXT_PUBLIC_POSTHOG_HOST` differ in kind from the contact secrets: a `NEXT_PUBLIC_*` value is
  **inlined by `next build`** into the client bundle, not read at runtime. So the "config-free image,
  env at runtime" rule does **not** apply - a runtime-only env would ship a keyless bundle from CI.
  The key is PostHog's *publishable* client token (in the browser by design, not a secret), so
  `src/lib/analytics.ts` carries a committed default and the CI/Docker build needs no new secret; the
  env var only overrides the default to target a different project. The private/personal (`phx_`)
  API key is never used anywhere.

## Contact endpoint (spec 0008)

- **Versioned route handler, `POST /v1/contact`** (`src/app/v1/contact/route.ts`) - a thin HTTP
  shell over the pure `src/lib/contact.js` (validation, honeypot, same-origin, rate limiter, Resend
  payload + send). The logic lives in a plain-JS seam so it is unit-tested by `node --test` without
  booting a server (same pattern as `src/lib/theme.js`); the route only maps request/env/outcomes to
  status codes (400/403/429/500, honeypot -> silent 200) and reads the secrets. Sends via `fetch` to
  Resend's REST API - no SDK dependency for one POST.
- **Spam guards are layered, not a single gate:** an offset honeypot (`company`, silent-drop),
  server-side validation with length caps, a best-effort in-process per-IP rate limit (single
  container by design; resets on restart), and a scheme-agnostic same-origin check (Origin/Referer
  host vs the request Host - forgeable, so it thins drive-by traffic rather than being a boundary).
  The privacy rule is enforced structurally: the destination is env-only, so it cannot appear in the
  client bundle or repo (a smoke/grep check guards against regressions).

## Analytics & observability (spec 0014)

- **PostHog (US Cloud)** for product analytics, session replay, and error tracking. Client via
  `posthog-js`, server via `posthog-node`. Logs (PostHog's OpenTelemetry/OTLP pipeline) are
  deliberately deferred to a separate spec (0015) - a materially heavier integration.
- **One config seam** `src/lib/analytics.ts` holds the publishable key, the client ingest host, the
  `ui_host`, and the region hosts - the last are imported by `next.config.ts` for the `/ingest`
  rewrites too, so a region change is a single edit and nothing is duplicated.
- **Client**: init lives in a module-scope, idempotent `initPostHogBrowser()`
  (`src/lib/posthog-browser.ts`), called at import time by `src/components/posthog-provider.tsx`
  (`"use client"`, mounted once in `layout.tsx`) - NOT in an effect. React flushes child effects
  before parent effects, so an effect-based init let the child `<PostHogPageView>` fire the first
  `$pageview` before load and it was dropped (feedback 0011); module-scope init loads the SDK first.
  Config: `capture_pageview: false` (App Router soft-navigates, so `src/components/posthog-pageview.tsx`
  fires `$pageview` per route change behind a `Suspense`), `capture_pageleave`, `capture_exceptions`
  (client autocapture), `persistence: "localStorage"` (cookieless), and `session_recording.maskAllInputs`.
- **Conversion tracking**: because `ph-no-capture` on the contact form also hides its submit from
  autocapture, the form fires explicit, PII-free events (`contact_form_submitted`/`_succeeded`/`_failed`,
  outcome only, no field values) from `handleSubmit` - the mask stays for replay privacy while the
  one conversion stays measurable (feedback 0011).
- **Server errors**: `src/instrumentation.ts` exports `onRequestError` (Node-runtime-guarded) which
  lazy-imports `src/lib/posthog-server.ts` (a singleton posthog-node client, `flushAt:1`) and calls
  `captureExceptionImmediate`, so RSC/route-handler/`/v1/contact` failures reach Error tracking.
  `src/app/global-error.tsx` is the client boundary for a root render crash.
- **Same-origin proxy**: `next.config.ts` `rewrites()` map `/ingest/static|array/*` to
  `us-assets.i.posthog.com` and `/ingest/*` to `us.i.posthog.com`, with
  `skipTrailingSlashRedirect: true` (PostHog ingest paths use trailing slashes Next would otherwise
  308-redirect). The browser never talks to `*.posthog.com` directly, so ad-blockers miss it and a
  future CSP needs no third-party `connect-src`. The **server** client posts directly to
  `us.i.posthog.com` (server egress is not ad-blocked and cannot use the browser-origin path).
- **Privacy by construction**: replay masks all inputs globally, and the contact `<form>` carries
  `ph-no-capture` so its subtree is never recorded even if the global mask regresses; the smoke test
  asserts both the marker and that the client bundle ships only the publishable `phc_` key (no
  personal `phx_` key). No consent banner (cookieless, all visitors); the documented escalation, if
  strict EU compliance is ever needed, is to gate only replay behind an opt-in.

## Repo layout (evolving — not prescriptive)

- `src/app/` — App Router routes and layouts.
- `src/components/` — UI and layout components.
- `src/lib/` — content loading (blog, projects) + scrubbed `resume.ts` data.
- `src/styles/` — `globals.css` + `theme-harbor.css` (Harbor palette; includes the `@media print`
  block that forces the light palette for the resume PDF).
- `scripts/` — build/authoring tools (e.g. `generate-resume-pdf.mjs`).
- `content/` — authored blog/project content (tracked; contains no PII).
- `public/` — static assets; the **committed** `resume.pdf` + `resume.pdf.hash`.
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
- **Resume PDF: committed artifact, rendered from the page.** `npm run resume:pdf` boots the
  standalone server and drives **headless system Chrome** (`--print-to-pdf`, no npm browser
  dependency) to render `/resume` with its `@media print` styles into `public/resume.pdf`, writing
  a sidecar `resume.pdf.hash` of the resume source files. The PDF is committed, so Docker/runtime
  serve a static file and never run a browser. Regeneration is gated on the source hash (no-op when
  unchanged); CI runs `resume:pdf:check` (a pure hash compare, no browser) and fails if the resume
  changed without the PDF being regenerated. The page is the single source of truth for both.
- **`outputFileTracingRoot` pinned to the project** (`next.config.ts`) so `output: standalone`
  emits `server.js` at the standalone root even inside the nested `.worktrees/` checkout; a no-op
  in CI/Docker. Both the smoke test and the PDF generator boot that server. (learnings 0002)
