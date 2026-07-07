# Architecture

## Stack

- **Framework:** Next.js (App Router) + TypeScript.
- **Runtime:** Next.js **Node server** via `output: 'standalone'`. Chosen over a static export
  because the contact form needs a server-side endpoint to send mail; standalone keeps SSR / route
  handlers / dynamic OG available without re-architecting later.
- **Styling:** Tailwind CSS **v4** (CSS-first) on the **Harbor** theme — `@rogueoak/roots` tokens
  re-branded via the roots brand pipeline: DTCG sources in `brand/harbor/` compile (`npm run
  theme:build`) to `src/styles/brand-harbor.generated.css` (an AA-guarded `:root` + `.dark` block);
  `src/styles/theme-harbor.css` adds only the print concerns. Harbor maps `primary` + the neutrals
  and inherits the rest (accent/secondary/status) from Roots. See `docs/design/brand-guide.md`.
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
- **Blog RSS feed (spec 0013):** a second pure, fs-free seam `src/lib/rss.js` (like `blog-view.js`)
  assembles the RSS 2.0 XML (`escapeXml`, `toRfc822`, `buildBlogFeed`), unit-tested without a server.
  The route `app/blog/feed.xml/route.ts` is a thin `force-static` `GET` that feeds `getAllPosts` and
  `site` into the builder and returns `application/rss+xml`. Absolute links are joined against
  `site.url` (the sitemap pattern); output is deterministic (`lastBuildDate` = newest post's date).
- **Content as data:** blog posts in `content/blog/*.mdx`, project data in `content/projects/`.
  No database, no runtime fetching.

## Metadata & sharing (spec 0004)

- **Next file conventions, not hand-rolled `<head>`:** `app/{favicon.ico,icon.png,apple-icon.png}`
  for icons; `app/opengraph-image.tsx` (+ a re-exporting `twitter-image.tsx`) for the share card;
  `app/{robots,sitemap,manifest}.ts` for the crawler/install surface. `layout.tsx` carries the
  default Open Graph / Twitter / robots metadata, a `viewport` `themeColor`, and a JSON-LD `Person`.
- **One source of truth:** identity/description/social come from `src/lib/site.ts`; sitemap routes
  come from its `nav`. Nothing is duplicated across the meta tags, sitemap, JSON-LD, and manifest.
- **Icons are generated, not hand-placed:** `scripts/build-icons.ts` resizes the
  `public/brand/logo-m.png` master with macOS `sips` and packs the multi-res `favicon.ico` with a
  stdlib ICO writer - no ImageMagick, no npm dependency. Re-run it to refresh every size at once.
- **OG image asset loading:** satori (the `next/og` engine) cannot read the woff2 that
  `@fontsource-variable` ships, so the static `@fontsource/figtree` package (a pinned devDependency,
  which ships woff + its OFL license) is the source. `scripts/build-og-fonts.ts` copies the woff +
  LICENSE into `src/app/_og/`, where `opengraph-image.tsx` loads them via
  `new URL(..., import.meta.url)` (traced into the standalone output). The card's headshot reads
  from `public/`, which the standalone/Docker copy step deploys next to `server.js`.

## Styling layers (import order matters)

`globals.css` imports, in order: `tailwindcss` → `@rogueoak/roots/tokens.css` →
`@rogueoak/roots/tailwind-preset.css` → `./brand-harbor.generated.css` (the Harbor brand; must win
the cascade, so a role Harbor omits keeps the Roots default) → `./theme-harbor.css` (print only) →
fontsource packages. Components read **only** Roots' semantic tokens, so light/dark re-theme with no
per-component code. Already implemented in `src/styles/`.

## Deployment

- **Container:** multi-stage Dockerfile (deps → build → runtime). Runtime is `node:24-alpine`
  serving the standalone output. Target image well under 200MB.
- **Local:** `docker compose up` (or `npm run dev`). The root `docker-compose.yml` builds from
  source and maps `3000:3000`; it is for local use only.
- **Host:** a small Linux VM running Compose stacks on a shared external `edge` network: **Caddy**
  (`deploy/docker/compose.proxy.yml` + `Caddyfile`) owns 80/443 and auto-provisions Let's Encrypt
  certs, reverse-proxying by hostname to the **site** (`deploy/docker/compose.site.yml`), which
  exposes 3000 only on `edge` (no host port). **This repo owns the shared proxy** for the host: the
  deploy job creates the `edge` network, validates the Caddyfile, and brings Caddy up on every
  deploy. **rogueoak.com is cohosted here** - the Caddyfile routes it to the `rogueoak` backend via the
  same dynamic-A upstream as the apex (spec 0019 amendment), so Caddy follows rogueoak's own
  zero-downtime rollout; the separate rogueoak repo deploys it as its own `edge` service (it ships no
  proxy of its own, so the two deploys never fight over 80/443). The two **deploy pipelines are kept
  symmetric** - same rollout install, `docker rollout`, health gate, `timeout-minutes`, `mem_limit`,
  and `prune -af` - differing only where they must: this repo owns the shared Caddy and runs the image
  `prewarm` job; each repo carries its own names/image/SITE_URL. A further site is one more `edge`
  service plus a Caddyfile block. The operator runbook is kept privately (git-ignored, not in the repo).
- **Images:** built off-host and pulled from GHCR (`ghcr.io/mattmaynes/matthewmaynes`, public), so
  the small server never runs a Next build. Tagged `latest` + immutable `sha-<commit>` for rollback.
- **CI/CD:** `.github/workflows/deploy.yml` - push to `main` runs verify (lint/build/test) →
  build+push to GHCR → SSH deploy to the server (`git pull`, ensure `edge` + validate/up the Caddy
  proxy, `compose pull` then a **zero-downtime rollout**) → **prewarm**.
  GHCR push uses the built-in `GITHUB_TOKEN`; the only repo secrets are the deploy SSH credentials.
- **Zero-downtime deploys (spec 0019):** the site is swapped **blue/green** with
  [`docker-rollout`](https://github.com/Wowu/docker-rollout) - a pinned, checksum-verified Docker CLI
  plugin (installed idempotently on the host by the deploy, treated as supply-chain surface like the
  SHA-pinned Actions). Instead of `compose up -d` recreating the one fixed-name container in place
  (stop→start = a hard-down window), rollout scales the `site` service to **two** Compose-indexed
  instances, waits for the new one's HEALTHCHECK, then removes the old. For Caddy to follow the swap
  the site block uses **dynamic A-record upstreams** (`dynamic a`, `resolvers 127.0.0.11`,
  `refresh 1s`) re-resolving the `site` alias against Docker's embedded DNS, so it load-balances
  across whatever instances are live; `lb_try_duration`/`lb_retries` + passive `fail_duration` cover
  the sub-second window between the old container's removal and the next refresh. A static
  `reverse_proxy site:3000` cannot do this - it resolves once and caches the old IP. `container_name`
  is dropped from `compose.site.yml` so two instances can coexist; the image is still pre-pulled so
  the new container starts instantly. A broken image never goes healthy, so the old instance keeps
  serving and the deploy fails - a bad build cannot take the site down. A one-time cutover (guarded by
  a name check, self-clearing) replaces the pre-0019 legacy `site` container the first time.
- **Rollout capacity (feedback 0015):** the blue/green overlap runs **two** site instances at once, so
  the VM must hold the peak - two Next servers **plus** Caddy and the cohosted rogueoak app - or the
  swap OOMs the box (it did once, on a 512MB no-swap VM: the host thrashed, `sshd` went unreachable,
  and Caddy was left with no backend). Guarded now by: a VM with headroom (~1GB) **and swap** (a 2GB
  swap file; the small box had none); a generous `mem_limit`/`mem_reservation` on the site service so
  one stack can't starve the shared box and take down its neighbour; and a `timeout-minutes` on the
  deploy job so a wedged host fails fast instead of hanging. Treat any deploy that changes runtime
  topology (instance count / memory) as a capacity change - size the host for the overlap first.
- **Image cache pre-warm (spec 0006):** the `prewarm` job runs after a healthy deploy and hits the
  live site (`node scripts/prewarm-images.ts $SITE_URL`, via Caddy to the fresh container) to
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
- Env vars: `NODE_ENV`, `SITE_URL` (`https://matthewmaynes.com`); for the contact form
  (spec 0008) `RESEND_API_KEY`, `CONTACT_TO_EMAIL` (the private destination), and
  `CONTACT_FROM_EMAIL` (verified-domain sender); and for the blog subscribe (spec 0018)
  `CTCT_CLIENT_ID`, `CTCT_REFRESH_TOKEN`, and `CTCT_LIST_ID` (the Constant Contact OAuth credentials
  + target list). All server-only (never `NEXT_PUBLIC_`), provided at runtime, never committed.
  `.env*` stays git-ignored; locally they live in `.env.local`.
- **Contact + subscribe secrets on the host:** `deploy/docker/compose.site.yml` reads them via
  `env_file: [.env.site]` (`required: false`). The operator creates `deploy/docker/.env.site` once
  (`chmod 600`); it is git-ignored and untracked, so the deploy's `git reset --hard` (no `git clean`)
  leaves it in place across deploys. The Constant Contact credentials were added to the same file
  (the refresh token was bootstrapped once via the device flow), so subscribe needed no compose or
  CI change. No new GitHub Actions secret is needed — the image is config-free and reads env at
  runtime.
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
  shell over the pure `src/lib/contact.ts` (validation, honeypot, same-origin, rate limiter, Resend
  payload + send). The logic lives in a pure, fs-free seam so it is unit-tested by `node --test`
  without booting a server (same pattern as `src/lib/theme.ts`); the route only maps request/env/outcomes to
  status codes (400/403/429/500, honeypot -> silent 200) and reads the secrets. Sends via `fetch` to
  Resend's REST API - no SDK dependency for one POST.
- **Spam guards are layered, not a single gate:** an offset honeypot (`company`, silent-drop),
  server-side validation with length caps, a best-effort in-process per-IP rate limit (single
  container by design; resets on restart), and a scheme-agnostic same-origin check (Origin/Referer
  host vs the request Host - forgeable, so it thins drive-by traffic rather than being a boundary).
  The privacy rule is enforced structurally: the destination is env-only, so it cannot appear in the
  client bundle or repo (a smoke/grep check guards against regressions).
- **Shared guards (spec 0018).** The honeypot, same-origin, and per-IP rate-limit helpers were
  extracted from `contact.js` into `src/lib/http-guards.js`; `contact.js` re-exports them (so
  `@/lib/contact` importers are unchanged) and `/v1/subscribe` imports them directly. They carry no
  feature-specific assumptions, so the two public endpoints share one implementation rather than
  duplicating it.

## Subscribe endpoint (spec 0018)

- **Versioned route handler, `POST /v1/subscribe`** (`src/app/v1/subscribe/route.ts`) - a thin HTTP
  shell over the pure `src/lib/subscribe.js` (email validation, the Constant Contact `sign_up_form`
  payload, the OAuth refresh-token exchange, the add-contact call, and an access-token cache) plus
  the shared `http-guards.js`. Same plain-JS testable seam as the contact core; the route maps
  request/env/outcomes to status codes (400/403/413/429/500, honeypot -> silent 200) and reads the
  secrets. Two `fetch` calls to Constant Contact, no SDK.
- **Token handling.** The route mints a 24h bearer token from the long-lived, **non-rotating**
  refresh token and caches it in module scope (with an expiry skew) so a burst of submits does not
  re-mint each time. The cache **memoizes the in-flight refresh**, so a concurrent cold-cache burst
  shares one mint rather than each caller hitting the auth server. Non-rotating means a refresh
  yields a new access token but the same refresh token, so nothing is persisted back; a restart just
  re-mints. If the cached token is invalidated upstream before its computed TTL (revocation, clock
  skew, early expiry), the add-contact call returns 401 and the core **self-heals once** - clears the
  cache, re-mints, and retries the add a single time - rather than failing every subscribe until a
  restart. The add-contact call hits the create-or-update `sign_up_form` endpoint with
  `create_source: "Contact"`, so a repeat email is idempotent (no duplicate error); on any non-2xx it
  throws **status-only** (never the response body, which can echo the submitted email into logs).
- **Optional name (spec 0018 amendment).** The client reveals an optional "Name" field on email
  focus and posts it alongside the email. `src/lib/subscribe.js` `splitName()` splits it on the first
  whitespace run (first token -> first name, remainder -> last name, each capped at the Constant
  Contact 50-char field limit), and `buildSignUpPayload` adds `first_name`/`last_name` to the
  `sign_up_form` body **only when present** - so a nameless signup posts the identical payload as
  before. The name is never logged; only a PII-free `has_name` boolean is tracked.
- **Spam guards** are the same layered set as the contact endpoint (honeypot, validation, per-IP
  rate limit, same-origin), via the shared `http-guards.js`. The OAuth credentials are env-only, so
  they cannot reach the client bundle or repo (guarded structurally, like the contact destination).
- **Consent (CASL).** The visible "Subscribe for updates" intent is the express-consent signal;
  Constant Contact owns the unsubscribe link and consent record on every send. Confirmed (double)
  opt-in, if ever wanted, is a Constant Contact account setting, not app code. No consent state is
  stored in the app.

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
- **Conversion tracking**: because `ph-no-capture` on the contact and subscribe forms also hides
  their submits from autocapture, each form fires explicit, PII-free events
  (`contact_form_submitted`/`_succeeded`/`_failed` and `blog_subscribe_submitted`/`_succeeded`/`_failed`,
  outcome only, no field values) from `handleSubmit` - the mask stays for replay privacy while the
  conversions stay measurable (feedback 0011).
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
- **Local runs never capture (spec 0016)**: a pure seam `src/lib/analytics-env.js` decides who
  captures. The client (`clientAnalyticsEnabled()`) requires `NODE_ENV === "production"` **and** a
  non-local `window.location.hostname`, so `next dev` (dev NODE_ENV) and any local production build
  (localhost) init nothing and send nothing - only the deployed client on a real host captures. It
  is a denylist ("not localhost") rather than an allowlist ("only matthewmaynes.com") on purpose: it
  errs toward capturing, so `www.`, an apex/IP variant, or a future host are never wrongly dropped.
  The server (`onRequestError`) gates on an **explicit deploy-only flag** `POSTHOG_SERVER_CAPTURE=1`
  set only in `deploy/docker/compose.site.yml`, plus `NODE_ENV === "production"`. This is because
  both the deployed *and* the local `docker-compose.yml` set `NODE_ENV=production`, and the proxied
  `Host` is unreliable, so NODE_ENV/host alone would leak a local production build's server errors
  to the live project (review of PR #53). The seam is unit-tested (`tests/analytics.test.mjs`), the
  client wiring is smoke-guarded (bundle ships the gate), and a Playwright check confirms localhost
  issues zero `/ingest` requests.

## Repo layout (evolving — not prescriptive)

- `src/app/` — App Router routes and layouts.
- `src/components/` — UI and layout components.
- `src/lib/` — content loading (blog, projects) + scrubbed `resume.ts` data.
- `src/styles/` — `globals.css` + `brand-harbor.generated.css` (the Harbor palette, generated from
  `brand/harbor/`) + `theme-harbor.css` (only the `@media print` block that forces the light palette
  for the resume PDF).
- `brand/harbor/` — DTCG source for the Harbor Canopy brand (`npm run theme:build` regenerates the
  CSS). See `brand/harbor/README.md`.
- `scripts/` — build/authoring tools (e.g. `generate-resume-pdf.mjs`).
- `content/` — authored blog/project content (tracked; contains no PII).
- `public/` — static assets; the **committed** `resume.pdf` + `resume.pdf.hash`.
- `context/` — **git-ignored** local planning notes and the private resume source.
- `docs/` — Spectra specs/plans/feedback/overview + `docs/design/` brand guide.

## Key decisions

- **Node server over static export** — to support the server-side contact form (and future
  dynamic needs) from day one.
- **Harbor on Roots** — bluer + slate palette with a warm (inherited) accent, applied purely at the
  token layer via the roots brand pipeline so the design system stays intact and dark mode is free.
  Harbor is a **partial** brand (maps `primary` + neutrals, inherits the rest); the pipeline's AA
  guard checks each override against the Roots default it lands next to — which is what caught and
  fixed a sub-AA dark primary the earlier hand-written override had shipped.
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
