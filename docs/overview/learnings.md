# Learnings

Capture lessons as you go.

## Scaffold (spec 0001)

- **Canopy needs a client boundary.** `@rogueoak/canopy`'s published `dist` does not carry
  `"use client"` directives, and its barrels evaluate React context at module scope (e.g.
  `FormField`). Importing Canopy directly into a Server Component fails the production build with
  `createContext is not a function`. Fix: re-export the components we use through one
  `"use client"` module (`src/components/ui.ts`) and import Canopy from there, never from
  `@rogueoak/canopy/*` directly.
- **Canopy ships classNames, not CSS.** Its utilities are only emitted if Tailwind scans the
  package source. `src/app/globals.css` adds `@source '../../node_modules/@rogueoak/canopy'`;
  without it the components render unstyled.
- **No-flash theming is dependency-free.** A tiny pre-paint inline script in `<head>` sets `.dark`
  on `<html>` from `localStorage.theme` (falling back to `prefers-color-scheme`). The toggle uses
  `useSyncExternalStore` over a `MutationObserver` on the class, which avoids the
  `set-state-in-effect` lint error and hydration mismatch hacks.
- **Standalone smoke test.** The route smoke test assembles the standalone artifact the way the
  Dockerfile does (copy `.next/static` + `public` next to `server.js`) and runs the real
  `server.js`, rather than `next start` (which warns under `output: 'standalone'`).
- **Assert what the unit uniquely produces, not shared chrome.** A test that checks text present in
  the header/footer on every page passes on the layout alone - it will not catch a blank or wrong
  body. Assert the route-unique `<title>`/`<h1>`, not nav labels. (feedback 0001)
- **Cover every named acceptance criterion.** Behavior called out in the spec (e.g. the theme
  toggle's system-default + persisted-override rule) needs a test. If the logic is trapped in a
  JSX string or a client component, extract a plain-module seam (`src/lib/theme.js`) so it is
  testable. (feedback 0001)

## Deploy (spec 0002)

- **`output: standalone` builds break inside the nested `.worktrees/` checkout.** With two
  lockfiles in the tree (the main checkout's and the worktree's), Next infers the *outer* repo as
  the workspace root and emits `server.js` at `.next/standalone/.worktrees/<slug>/server.js`, so
  the standalone smoke test (which expects `.next/standalone/server.js`) fails - even though CI
  (fresh single-lockfile checkout) and the Docker build (single lockfile in `/app`) are fine. To
  verify the smoke test while building in a worktree, run it from a clean single-root export
  (`git archive HEAD | tar -x -C /tmp/...`), or set `outputFileTracingRoot` in `next.config.ts`.
- **A CD/SSH deploy is not done when the happy path works.** Model the failure paths: gate on
  container **health** (`compose up -d --wait`), not creation, or a crash-looping image ships
  green; **authenticate** the target host (pin a `known_hosts` secret, never `ssh-keyscan` on the
  fly = MITM TOFU); **pin dependencies** to commit SHAs (mutable Action tags + `packages: write` =
  supply-chain RCE) and keep elevated tokens job-scoped. Also pin the deployed image tag for
  auditable rollback rather than chasing `:latest`. (feedback 0002)
- **Test on the runtime's Node version, not just your local one.** `node --test "tests/**/*.glob"`
  (quoted) needs Node 21+ glob support; on the pinned Node 20 (matching `node:20-alpine`) it found
  nothing and reddened the first CI run, despite passing locally on a newer Node. Use a
  shell-expanded glob (`tests/*.test.mjs`) for portable discovery, and run the suite on the pinned
  Node (a `node:20-alpine` container) before trusting green. (feedback 0003)
- **A green deploy can still ship stale source.** With `cache-from/to: type=gha`, buildx restored
  an outdated `COPY . .` layer, so `npm run build` ran on old code and the new image served old
  HTML - every job green. Verify deploys against the *running container's* output, not the job
  status; and prefer no cross-run build cache (`no-cache: true`) on a small app, or a cache keyed
  so a source change always busts the copy+build layers. (feedback 0004)

## Content pages (spec 0003)

- **A placeholder route that gains real content needs a tighter smoke assertion in the same PR.**
  The generic per-route check (route-unique `<title>` + "an `<h1>` exists") is a resolve probe the
  old `PagePlaceholder` already satisfied, so a blank body or a reverted placeholder would still
  pass. The smoke table now takes optional `contains`/`absent` body substrings; assert a
  route-unique phrase is present (and any placeholder badge is gone) when shipping real copy. This
  recurred from feedback 0001's "assert what the unit uniquely produces" lesson. (feedback 0006)

## SEO & sharing (spec 0004)

- **`next/og` (satori) cannot read woff2.** `@fontsource-variable/figtree` ships woff2 only, so
  passing it to `ImageResponse` fails. satori does read woff/ttf/otf - and the *static*
  `@fontsource/figtree` package ships woff (plus its OFL license), so add it as a pinned
  devDependency and derive the card fonts from it (`scripts/build-og-fonts.ts`) rather than
  downloading ad-hoc binaries with no provenance. Colocate the woff in `src/app/_og/` and load via
  `new URL('./_og/figtree-NNN.woff', import.meta.url)` so they are traced into the `output:
  standalone` build (a `process.cwd()`-relative read of `src/` would not be - `src/` is not
  deployed). Commit the OFL `LICENSE` beside the fonts (OFL requires it to travel with the
  binaries). Assets the OG route reads from `public/` are fine: the standalone copy step puts
  `public/` next to `server.js`, so `join(process.cwd(), 'public/...')` resolves.
- **Verify the generated OG image, do not assume it built.** A green `next build` only proves the
  route compiled; a wrong font/logo path renders a blank or broken card. The smoke test fetches the
  `og:image` URL's path on the local server and asserts a `200` + `image/png`, and the card was
  eyeballed from `.next/server/app/opengraph-image.body` before commit.
- **Turbopack rejects a cross-root `node_modules` symlink.** The clean-export trick for testing in a
  worktree (build from a single-lockfile copy outside the repo) breaks if you *symlink* node_modules
  into it (`Symlink ... points out of the filesystem root`). Hardlink-copy it instead
  (`cp -al node_modules <export>/node_modules`) - fast on one APFS volume, and the build only writes
  to `.next`.
- **No new dependency for the icon set.** macOS `sips` resizes and a ~40-line stdlib ICO packer
  (`scripts/build-icons.ts`) writes a multi-res `favicon.ico` with PNG payloads. Reproducible from
  one master (`public/brand/logo-m.png`), no ImageMagick.

## Images (spec 0005)

- **`next/image` alone does not stop flicker.** It reserves space and optimizes bytes, but an
  image with no `placeholder` still renders blank then pops in after decode. For locally-bundled
  images, **static-import them** (carry them as imports in the `src/lib/site.ts` `images` map, not
  string paths) so `placeholder="blur"` gets an auto-generated `blurDataURL` for free; pass the
  whole import as `src`. Reserve `priority` for above-the-fold images so they are not lazy-loaded,
  and set `images.formats = ["image/avif","image/webp"]` (default is WebP-only) - AVIF cut the
  640px hero from a ~1 MB PNG to ~30 KB. (feedback 0005)
- **A cosmetic change still needs a guard, and the smoke test must boot in a worktree.** The blur
  treatment passed every existing smoke assertion (200 + title + h1) even when reverted, so it
  could regress silently. The smoke test now asserts image-bearing routes inline a
  `data:image/...;base64,` blur placeholder. It also had to be taught to *find* `server.js`: the
  two-lockfile quirk nests it under `.next/standalone/.worktrees/<slug>/`, so the old hard-coded
  `.next/standalone/server.js` path missed and the suite never ran in a worktree. `findServerJs()`
  now walks the standalone dir (skipping `node_modules`) and the artifact is assembled next to the
  real `server.js`. (feedback 0005)

## Resume page + PDF (spec 0005)

- **Do not hash rendered Next HTML to detect content changes.** The plan was to gate PDF
  regeneration on a hash of the served `/resume` HTML; in practice Next embeds per-build asset
  hashes and RSC payloads, so the same content yields different HTML every build - the gate would
  fire constantly. Hash the **source inputs** instead (`resume.ts`, the page, the print CSS): it is
  deterministic and is literally "regenerate when the resume changes". The committed PDF + a
  source-hash sidecar also lets CI verify freshness with a pure hash compare - no browser in CI or
  Docker, only on the developer's machine when they run `npm run resume:pdf`.
- **A freshness gate for a generated artifact must hash EVERY input that affects the output, and
  regenerate from a clean rebuild.** The first cut hashed only `resume.ts`/page/print-CSS (missing
  `site.ts` + the headshot) and reused any existing standalone build - so Chrome could render a
  stale page while the new hash was written, and a `site.location` edit passed `--check` while the
  PDF drifted. A gate over a subset of inputs, or one that re-renders a cached build, certifies
  stale output as fresh - worse than no gate. Fix: complete `INPUT_FILES`, and always `next build`
  in generate mode. (feedback 0007)
- **Encode a privacy/PII acceptance criterion as an automated assertion, not human review.** On a
  public site, the spec's "no email/phone/postal" rule is now a smoke assertion on the `/resume`
  HTML (which also covers the PDF, since it renders from the page), so a future edit can't silently
  reintroduce contact info. (The placeholder-vs-real guard it also needs is the same lesson as
  Content pages above.) (feedback 0007)

## Image performance (feedback 0006)

- **For on-demand `next/image` optimization, source size dominates - fix sources before formats.**
  The blur placeholder lingered because the first visitor after each deploy decoded oversized
  ~1 MB lossless PNGs before re-encoding (cold optimizer cache). Right-sizing the sources (photos
  to quality-86 JPEG, hero capped at 1600px; flat graphics stay PNG) cut far more first-paint
  latency than the AVIF-vs-WebP choice did. Because the 0005 static-import refactor derives
  width/height from the files, swapping PNG->JPEG only touched the import paths in `site.ts`.
- **Measure the image optimizer honestly or you will misdiagnose.** Two traps burned a cycle here:
  (1) the FIRST image request to a fresh server also pays one-time `sharp` init (~0.5-0.7s), so
  timing "AVIF first, WebP second" charges that init to AVIF and fabricated a fake "~10x slower"
  gap - warm the process with a throwaway request first; (2) without a browser `Accept:
  image/webp,...` header Next serves the unoptimized source (`content_type: image/jpeg`) and you
  time passthrough, not encoding. Clean runs showed AVIF only ~0.02-0.03s/image above WebP. WebP-
  only is still the pick for fastest first paint, but the honest reason is source size, not format.
- **Building inside `.worktrees/` now needs its own `node_modules` (`npm ci`).** Once
  `outputFileTracingRoot` was pinned to the project dir (learnings 0002), Turbopack restricts
  compilation to that root and can no longer resolve `next` from the parent checkout's
  `node_modules`; a symlink to the parent is rejected ("points out of the filesystem root"). Run
  `npm ci` in the worktree before `npm run build`. (The build/CI/Docker single-root path is
  unaffected.)

## Image caching: two layers, two fixes (spec 0006)

- **Separate the browser cache from the server optimizer cache before "fixing" image caching.**
  They are independent and have different remedies. (1) Browser: `/_next/image` responses for
  content-hashed static imports already return `Cache-Control: public, max-age=315360000, immutable`
  - effectively permanent, with URL-hash busting on change, so no header tuning is ever needed for a
  "keep it cached" ask. (2) Server: the on-demand optimizer encodes each variant on first request
  (`X-Nextjs-Cache: MISS` -> `HIT`) and a fresh container starts cold - that, not the browser, is
  what makes the first post-deploy visitor wait. The fix is a post-deploy **prewarm** that requests
  each variant, not a cache-control change. When asked to "cache images longer," check which layer
  the symptom is actually in.
- **Warm by crawling the rendered pages, not a hardcoded URL list.** The optimized URLs encode a
  content hash and the exact srcset widths from each image's `sizes`; only the live HTML knows them,
  so a crawl stays correct as images/layouts change. Verify warming honestly with `X-Nextjs-Cache`
  (and the same browser `Accept` header), the same way image encode timing must be measured
  (feedback 0006).

## Parallel test files share one build dir (review 0006)

- **`node --test tests/*.test.mjs` runs files in PARALLEL, so two files that each lazily
  `next build` into the same `.next` race and corrupt it.** Adding a second server-booting test
  (the prewarm integration test alongside the smoke test) turned a clean-tree `npm test` red with
  `next build failed`, while CI stayed green only because it builds before testing. Fix:
  `--test-concurrency=1` in the `test` script so files run sequentially (the first builds, the rest
  reuse). When adding a test that boots the standalone, remember it shares the lazy-build hook with
  every other such file.
- **Make a deploy-time best-effort step actually bounded.** A warmer/poller that fetches over the
  network must cap each request (`AbortSignal.timeout`) AND its CD job (`timeout-minutes`); Node
  `fetch` waits forever, and a stalled best-effort job coupled to a `concurrency`-serialized deploy
  lane will queue the next deploy behind it. "Best-effort" means it also fails fast, not just that
  it ignores errors. (spec 0006)

## PR checks must gate before deploy, not only after merge (feedback 0008)

- **Every check the deploy pipeline enforces must also run on the PR, before merge.** The
  lint/`resume:pdf:check`/build/test gate lived ONLY in `deploy.yml` (`on: push: branches: [main]`),
  which runs AFTER the merge. There was no `pull_request` workflow, so nothing blocked a bad PR: a
  stale `public/resume.pdf` merged in #21 and then failed every post-merge deploy until it was
  regenerated - silently keeping #22-#25 off the live site too. A post-merge gate cannot stop a bad
  change; it only discovers it once it is already on `main`. Fix: a `pull_request` CI workflow that
  runs the same checks, so red blocks the merge.
- **Share one gate definition between PR CI and deploy; never duplicate it.** The PR check and the
  deploy check must be identical - if they drift, a check can pass on the PR and fail post-merge (the
  exact failure mode here). Extracted the steps into a reusable workflow (`verify.yml`,
  `on: workflow_call`) called by both `ci.yml` (PR) and `deploy.yml` (push).
- **A required check needs branch protection to actually block.** `main` had no protection at all,
  so even a red check would not stop a merge. Adding the workflow is only half the fix; the
  `verify / verify` check must be marked required in branch protection on `main`.

## Site chrome on Canopy TopNav (refactor 0009)

- **The site header/footer/theme-toggle now render from Canopy, not hand-rolled markup.** The header
  is Canopy's `TopNav` Branch (`TopNavBrand`/`TopNavLinks`/`TopNavLink`/`TopNavActions`/
  `TopNavMenuButton`); the theme toggle and the footer social links are Canopy `Button`s
  (`variant="ghost" size="icon"`, the social links via `asChild` over an `<a>`). All Canopy
  imports go through the `src/components/ui.ts` client boundary (learnings 0001), so the
  Server-Component footer can still render them.
- **`TopNav` gives mobile hamburger-on-the-left for free (Canopy >= 0.2.1).** `TopNavMenuButton`
  carries `order-first`, so the toggle sits at the left of the bar with no per-consumer CSS. This is
  why the fix belonged in Canopy, not in a local override: the site's OLD custom header put the
  hamburger on the right, and only swapping to `TopNav` inherits the design-system behaviour.
- **`TopNav` is a full-width bar, not a max-width container.** The old custom header centered its
  content in `max-w-[1200px]`; `TopNav` renders a full-bleed `<header><nav>` (border + bg span the
  viewport) with `px` gutters and no inner width cap. Overrides land via `className` +
  tailwind-merge (e.g. `bg-surface/95 backdrop-blur ... px-6` win over the bar defaults), but the
  1200px centering is intentionally dropped to stay Canopy-native. Accept the component's layout
  rather than fighting it; if a capped width is ever required, that is a Canopy change, not a local
  wrapper.

## Icons from @rogueoak/icons (spec 0007)

- **The site's icons now come from `@rogueoak/icons`, not hand-rolled SVGs.** The brand marks
  (LinkedIn/GitHub/X) and the theme toggle's sun/moon are the curated Canopy set (Lucide UI
  glyphs + Font Awesome 6 brands). All five were already in the published registry (0.2.0), so
  no Canopy change/release was needed - the site just added the dependency.
- **`@rogueoak/icons` needs a client boundary in a Server Component, same as Canopy.** Its
  barrel (`export { Icon, IconProvider }`) evaluates `React.createContext` at module scope, so
  importing it into a Server Component (footer, resume page) fails the RSC build with
  `createContext is not a function` (learnings 0001, verbatim). Fix: `src/components/
  social-icons.tsx` is a `"use client"` module that wraps the package icons and keeps its old
  export names (`LinkedInIcon`/`GitHubIcon`/`XIcon`), so the footer and resume call sites - and
  their `className` sizing - never changed. `theme-toggle.tsx` was already a client component,
  so it imports `Sun`/`Moon` directly.
- **A resume-page-only visual change needs `--force` to re-render the PDF.** The PDF freshness
  hash covers `src/lib/resume.ts` + `src/lib/site.ts`, NOT `src/app/resume/page.tsx`. Swapping
  the sidebar icons changed the page but not the hash, so `npm run resume:pdf` reported "nothing
  to regenerate" and the committed PDF would have kept the old glyphs. Run
  `node scripts/generate-resume-pdf.ts --force` when the resume *page* (not its data) changes.

## Contact form (spec 0008, feedback 0009)

- **A spec/plan/feedback doc is a tracked, public artifact - never put a secret or PII in one,
  not even as an illustration.** The security persona caught the private destination Gmail
  written verbatim into `docs/specs/0008-*.md` (twice) - the exact leak the feature exists to
  prevent - and it had already been pushed to the public branch. The runtime code kept the
  address in env correctly; the *prose* undid it. Refer to such values by their env var
  (`CONTACT_TO_EMAIL`), never the literal. When a leak does reach a pushed branch, scrub +
  rewrite history (amend + force-push) so no commit on the branch carries it, then re-grep;
  note the orphaned pre-rewrite commit can linger in the host's reflog until GC (an email is not
  a rotatable secret, so flag the residual exposure to the owner).
- **Derive the client IP from the proxy's ACTUAL `X-Forwarded-For` behavior, not the generic
  "client is the first entry" rule.** Our Caddy *appends* the real client IP as the **last** XFF
  entry, so reading `[0]` let a bot forge a rotating prefix and walk straight past the per-IP
  rate limit. Check the Caddyfile's forwarding before picking the index; take the last hop, or
  configure `trusted_proxies`. Rate-limit keys must be values the client can't rotate.
- **Guard/error paths are testable without the happy-path dependency - don't defer them as
  "needs creds".** The 429, config-500, cross-origin-403, and honeypot-200 paths all return
  before the send, so they need no Resend key. Spawn the smoke server with the creds forced
  empty so even a keyed developer machine can't send a real email while exercising them, and give
  each rate-limit test a distinct `X-Forwarded-For` so they don't taint each other's limiter key.
- **Assert the unit under test, again (cf. learnings 0001/0003).** The `/contact` smoke first
  asserted "Find me elsewhere" - the *social-row* heading - so a broken `<ContactForm/>` would
  have passed. Anchor on form-unique copy (the textarea placeholder). The privacy criterion is
  now an automated `/contact` assertion (flags any email but the example placeholder), mirroring
  the `/resume` PII guard - a public-site PII rule belongs in a test, not human review.
- **The contact core is a pure, fs-free seam (`src/lib/contact.ts`), like `theme.ts`.** Validation,
  honeypot, same-origin (host-compare, scheme-agnostic), the bounded in-memory rate limiter, and
  the Resend payload/send live there so `node --test` covers them directly (Node strips the TS
  types at load, no build step); the
  `POST /v1/contact` route handler is a thin shell that maps request/env/outcome to status codes.
  Send is a plain `fetch` (timeout-bounded) to Resend's REST API - no SDK dependency for one POST.

## Blog content pipeline (spec 0009, feedback 0010)

- **An acceptance test over a single-item fixture proves nothing about ordering/filtering/dedup
  logic.** The "newest-first" criterion was only checked via `getAllPosts` against the one-post
  content dir, so the sort loop never ran and an inverted comparator would pass green - the same
  "assert what the unit uniquely produces" trap (feedback 0001/0003/0006) applied to *collection
  logic* rather than page chrome. Fix: extract the logic into a pure exported function
  (`sortPostsNewestFirst`) and test it against a multi-item fixture, asserting order *and*
  non-mutation. When a test's realism depends on fixture size, feed it a fixture, don't lean on
  production data.
- **A pixel-art / fixed-resolution image is not a full-bleed hero.** Styling the tiny 192px Turing
  cover with a full-width mat left a stamp floating on a huge panel, misaligned with the
  left-aligned prose column. Constrain such a cover to the reading measure (`max-w-2xl`) and let it
  fill/upscale crisply with `image-rendering: pixelated`; never blur-upscale it. The per-post OG
  card integer-scales the same asset on a dark mat for the same reason.
- **MDX is build-time code execution, not inert content.** `next-mdx-remote` `compileMDX` compiles
  and runs the `.mdx` - arbitrary JSX/`<script>`/raw HTML/`import`/expressions would execute. Safe
  here because it only ever compiles our own tracked files and posts are constrained to prose + the
  known `<PostImage>` component (enforced by review, documented in AGENTS.md). Any move to
  untrusted/multi-author content would need sanitisation (rehype-sanitize) or an allowlist.
- **A per-post metadata image route needs `generateStaticParams` too.** Without it the
  `opengraph-image` route is dynamic and reads `content/` per request, working only because Next
  file-tracing happened to copy the `.mdx` into the standalone output - fragile. Enumerate the
  slugs so the card bakes at build, like the page.
- **Canadian English is `-our`/`-re` but `-ize`.** colour/honour/centre, yet realize/organize/
  recognize (not the British `-ise`). The blog carve-out's own examples had this backwards at first.

## PostHog analytics (spec 0014)

- **`NEXT_PUBLIC_*` is inlined at build time, not read at runtime.** The "config-free image, env at
  runtime" pattern that works for the contact secrets does NOT work for a client key: a
  runtime-only env ships a keyless bundle from CI. Give a `NEXT_PUBLIC_*` value a committed default
  (safe here - the `phc_` key is publishable), and keep the env var as a build-time override only.
- **Next does not export the `Instrumentation` type from its top level.** `import type
  { Instrumentation } from "next"` does not resolve (it lives under `next/dist/server/...`, an
  unstable deep path). Type the `onRequestError` export inline with an explicit signature instead of
  importing the namespace; Next validates the export shape structurally.
- **posthog-node `captureException` is fire-and-forget (`void`).** In `onRequestError`, use
  `captureExceptionImmediate` (returns a Promise) and `await` it so the event flushes before the
  handler returns, rather than relying on background batching around a request that may be ending.
  Wrap it in try/catch - the error hook must never throw (a slow ingest would surface as an
  unhandled rejection). (feedback 0011)
- **Initialize a shared client at module scope, not in a parent effect.** React flushes child
  passive effects before parent effects, so `posthog.init()` in the provider's `useEffect` ran
  *after* the child `<PostHogPageView>` effect's first `capture("$pageview")` - and posthog-js drops
  captures made before load (no buffering), so the landing pageview was lost every session. Anything
  a child effect needs on first paint must exist before render: init at module load with a
  `typeof window` guard. Verify runtime analytics in a real browser (Playwright network panel: the
  landing `$pageview` and each route change should POST to `/ingest`), not just via unit tests.
  (feedback 0011)
- **Masking an element for replay also removes it from autocapture.** `ph-no-capture` on the whole
  contact form (right call for PII in session replay) also stopped PostHog autocapturing the submit,
  so the site's one conversion emitted no event. Masking and measuring are separate decisions on the
  same element: keep the mask and track the conversion with explicit, PII-free events (outcome only,
  never field values). (feedback 0011)
- **Verify design-token class names against the theme, don't assume them.** `text-on-primary` does
  not exist (`--color-primary-foreground` does) and `text-muted` is a surface fill, not text
  (`text-text-muted` is the text token) - both rendered unreadable. Grep `theme-harbor.css`/Roots
  for the real token before using a `text-*`/`bg-*` utility. A page that renders its own `<html>`
  (like `global-error.tsx`) must also include `<ThemeScript>` or it ignores the visitor's theme.
  (feedback 0011)
- **`NODE_ENV === "production"` is not a "deployed" signal.** A local production build (`npm start`,
  the smoke test, Playwright) sets it too - and this repo's *local* `docker-compose.yml` sets
  `NODE_ENV=production` as well - so gating server-side analytics on NODE_ENV leaked local-prod-build
  server errors to the live project. To mean "only the real deployment", use an explicit deploy-only
  env flag set solely in the deployed stack (`POSTHOG_SERVER_CAPTURE` in `compose.site.yml`), or on
  the client the browser's real `window.location.hostname`. Prefer a capture denylist ("not
  localhost") over an allowlist ("only the canonical host") so real traffic from `www.`/IP/new hosts
  is never wrongly dropped - losing real data is worse than a rare stray local event. (feedback 0012)

## Blog reading experience (spec 0011)

- **A JS-core / TS-wrapper pair that shares a basename (`blog.js` + `blog.ts`) resolves the
  `./blog.js` import to the sibling `.ts` at type-check time.** So `blog.ts` importing a name from
  `"./blog.js"` type-checks against `blog.ts`'s *own* exports, not the JS file - it works only
  because each wrapper (`getAllPosts`, `getPostBySlug`) re-exports a same-named symbol. Adding
  `estimateReadingMinutes` to `blog.js` type-errored ("no exported member") until `blog.ts` also
  exported a same-named typed wrapper; at runtime Node still resolves to the real `blog.js`, which
  is why `node --test` passed while `tsc`/`next build` failed. New pure-core exports need a matching
  wrapper export in the `.ts` seam. (A same-basename `.js`/`.ts` scratch pair reproduces the error
  and is easy to mistake for a syntax problem.)
- **A larger body size is a semantic token, not a raw Tailwind step (review 0011).** The first cut
  set the post body to raw `text-lg`, outside the Roots type scale everything else reads from
  (`text-body`/`text-caption`/`text-h2`, each with paired line-height/weight). The fix was a
  `text-body-lg` role - `@theme inline { --text-body-lg / --line-height / --font-weight }` mirroring
  how Roots declares `--text-body` - so the body stays on a named token and dark/print/line-height
  come free. On a token-first codebase, add a role, don't reach for a raw utility. Verify it emits:
  grep the built CSS for `.text-body-lg{font-size:...}` - a mis-declared `@theme` yields a silent
  no-op class.
- **A global type token goes in the Tailwind entry (`globals.css`), not `theme-harbor.css` - the
  latter is a resume-PDF hash input (review 0011).** `theme-harbor.css` is in the resume PDF's
  `INPUT_FILES` (it carries the resume `@media print` block), so any edit to it fails
  `resume:pdf:check` until the PDF is regenerated. `resume:pdf:check` runs in CI (`verify.yml`) but
  is NOT in the local `npm test`/`lint`/`build` set, so a `theme-harbor.css` edit passes locally and
  reddens only on the PR. A resume-irrelevant token (like `text-body-lg`) belongs in `globals.css`
  (not a PDF input), avoiding needless artifact churn. When touching `theme-harbor.css` for real,
  run `resume:pdf:check` locally and regenerate with `npm run resume:pdf` before pushing.
- **A cosmetic change still needs a guard that can actually fail - again (cf. feedback 0005).** The
  reading-time/byline/disclaimer smoke markers all stayed green when the body-size bump (the spec's
  headline outcome) was reverted, because none touch typography. Caught in review as a major: the
  smoke test now also asserts the `text-body-lg` class marker. Every visible acceptance criterion
  needs its own marker; shared-chrome markers do not cover a separate visual change.
- **Keep icon wrappers purpose-scoped (review 0011).** The reading-time `Clock` wrapper first landed
  in `social-icons.tsx` (brand/social glyphs); it belongs in its own `blog-icons.tsx`, matching the
  existing `nav-icons.tsx` split. Same `"use client"` boundary; the module's *purpose* is the axis
  to split on, so blog-surface icons (Clock now, Search/Rss later) share one home.
- **React SSR inserts an HTML comment between adjacent static text and an expression.** `By
  {site.name}` renders as `By <!-- -->Matthew Maynes`, so a smoke test asserting the contiguous
  substring "By Matthew Maynes" fails. Render one interpolated node (`{`By ${site.name}`}`) when a
  marker must stay contiguous for a substring assertion.

## Blog discovery: tag filter, search, New badge (spec 0012)

- **`useSearchParams` forces a client-render bailout that empties a static page's SSG HTML.** The
  first cut of the listing island read `?tag=` via `useSearchParams` and wrapped it in `<Suspense>`
  (as the build tells you to). But on a statically-generated route that pairing makes Next render
  only the Suspense *fallback* into the prerendered HTML and defer the whole subtree to client-only
  rendering - so the post rows, dates, tag chips, and search input were absent from `blog.html`
  (the smoke test caught it: "June 28, 2026" missing). That also defeats the spec's "content stays
  statically generated" goal and SEO. Fix: don't use `useSearchParams` for URL-synced state on a
  static page. Make the URL an external store read through `useSyncExternalStore` (server snapshot
  `""` so SSR renders the unfiltered list) and update it with synchronous `history.replaceState` +
  a manual listener poke (it doesn't emit `popstate`). This is the same `useSyncExternalStore`
  pattern the theme toggle used to dodge the `set-state-in-effect` lint rule (learnings 0001) - a
  naive `useEffect(() => setActiveTag(readUrl()))` restore trips that rule; the store does not.
- **`Date.now()` in a Server Component's render body trips `react-hooks/purity`.** Computing the
  "New" badge's reference time inline (`newPostSlug(posts, Date.now(), 30)`) fails lint ("Cannot
  call impure function during render"). Hoist it to a module-scope `const NOW_MS = Date.now()`,
  which is evaluated once when the route module loads - i.e. at build time for the static page,
  which is exactly the intended "new as of this build/deploy" semantics.
- **A client island's filter/format logic goes in a pure, fs-free `.js` core, not inline (review
  0012).** The tag dedup, `?tag=` resolution, tag+search composition, and date formatting first
  lived inside `blog-list.tsx`, exercised only by the single seed post - so an inverted tag match or
  a dropped search field would ship green (recurring learning 0009 / "assert what the unit
  produces"). But the island can't import `blog.js`/`blog.ts` to share the logic: their import graph
  pulls in `node:fs`, which breaks the client bundle. Fix: a separate `src/lib/blog-view.js` -
  pure, fs-free, `node --test`-importable - holding `formatPostDate`, `deriveTags`,
  `resolveActiveTag`, `filterPosts`. The island and the Server page both import it; `blog.ts`
  re-exports `formatPostDate` from it so server callers are unchanged (and the island's duplicate
  date formatter is gone). When a client island needs logic that also lives server-side, the shared
  home is a third fs-free module, not either fs-coupled side.

## Blog RSS feed (spec 0013)

- **Guard feed autodiscovery by its mimetype, not the feed href (review 0013).** The `/blog` smoke
  test asserted the subscribe button via a root-relative `href="/blog/feed.xml"`, which does NOT
  cover the `<link rel="alternate" type="application/rss+xml">` autodiscovery tag: `metadataBase`
  renders that link's href ABSOLUTE (`https://.../blog/feed.xml`), so the root-relative marker never
  matches it - deleting the `alternates` metadata stayed green. Assert `application/rss+xml` (the
  mimetype, present only on the alternate link) to guard autodiscovery, and assert the subscribe
  link on BOTH surfaces (listing and post), not just the listing.
- **`toRfc822` (and any feed date) must fail loudly on a bad date.** An unparseable frontmatter date
  produced `NaN undefined NaN ... GMT` - an invalid pubDate readers reject - instead of failing.
  Throw on `Number.isNaN(d.getTime())`, like `blog.js`'s required-field check, so a typo breaks the
  build rather than shipping a broken feed.
- **`src/lib/site.ts` is a resume-PDF input: any export you add there forces a PDF regen (review
  0013).** Hoisting the shared `blogFeedTitle` constant into `site.ts` (the right home for site-wide
  config) tripped `resume:pdf:check` because `site.ts` is in the resume PDF's `INPUT_FILES` - even
  though the constant never renders on the resume. Same shared-input coupling as `theme-harbor.css`
  (learnings 0011), but `site.ts` is a legitimate resume input, so the fix is to regenerate
  (`npm run resume:pdf`) and commit `public/resume.pdf` + `.hash`, not to relocate. Editing
  `site.ts` always means a PDF regen in the same PR.

## Cohosting a second site behind the shared Caddy proxy

- **`compose up -d` does NOT apply a changed Caddyfile.** The Caddyfile is a read-only bind mount,
  so editing it is not a service change: Compose does not recreate or reload the container, and Caddy
  keeps running its old config (observed: `caddy` up for days after a Caddyfile change never took).
  Cohosting rogueoak.com added its vhost to the file but the running proxy ignored it, so its TLS
  handshakes failed (no cert) even though the config on disk was correct. The deploy now hashes the
  Caddyfile across the `git reset`, and on a change runs `caddy reload`, verifies every site block
  reached the running config (`/config/` admin API), and restarts as a fallback - a long-lived
  container was seen to silently no-op a `reload` (exit 0, config unchanged); only a restart applied
  it and triggered ACME.
- **Pin `DEPLOY_KNOWN_HOSTS` by the same identifier the workflow's `DEPLOY_HOST` uses.** When a
  cohosted repo's `DEPLOY_HOST` is a hostname (e.g. `rogueoak.com`) that used to point at a different
  server, its pinned host key is stale after the DNS cutover and the deploy fails with "REMOTE HOST
  IDENTIFICATION HAS CHANGED" before running anything. Regenerate with `ssh-keyscan <hostname>` (not
  just the IP) so the key matches the identifier being connected to.

## Zero-downtime deploys (spec 0019, feedback 0014)

- **Verify a user-facing deploy property at the EDGE the user hits, not the component you changed.**
  The blue/green rollout first gated only on the container's internal HEALTHCHECK (`localhost:3000`
  inside the container). That proves the app answers, not that Caddy's new dynamic-upstream routing
  reaches it - a wrong resolver/alias/IP-version leaves every container healthy and the deploy green
  while every visitor gets a 502. Fix: a post-rollout `curl` through Caddy over loopback
  (`--resolve host:443:127.0.0.1`, no DNS/hairpin dependency) that fails the deploy on non-200. The
  inner healthcheck passing is not the same as the outer path working, and they disagree exactly when
  it matters (availability, routing, latency).
- **A load-bearing but silently-revertible config needs a PER-DEPLOY gate, not a one-time check.** The
  Caddy dynamic-upstream block is the whole zero-downtime guarantee; reverting it to a static
  `reverse_proxy site:3000` would restore per-deploy downtime with nothing reddening. The post-rollout
  health gate re-verifies routing on every deploy, so a future regression fails the deploy that
  introduced it - a manual one-time poll cannot.
- **Caddy caches a static upstream's resolved IP; use dynamic upstreams to follow a container swap.**
  `reverse_proxy site:3000` resolves the alias once and reuses the IP, so after a rollout it keeps
  hitting the removed container. `dynamic a` with `resolvers 127.0.0.11` + a short `refresh` re-resolves
  the Docker service alias (embedded DNS returns all live instance IPs), so Caddy load-balances across
  whatever is up. Cover the sub-refresh window with `lb_try_duration`/`lb_retries` (a dial failure to
  the just-removed IP retries the live one). Avoid passive `fail_duration`/`unhealthy_status` for a
  single steady-state upstream: they would mark the only backend down on one 5xx/blip with nowhere to
  fail over.
- **Prefer the general tool's built-in transition over a special-cased path.** The first-cut one-time
  cutover (`docker rm -f site` then recreate) reintroduced the exact hard-down window and was not
  fail-safe. `docker rollout` already adds an indexed instance alongside the legacy one and removes the
  old only once the new is healthy - so plain rollout does the legacy->indexed cutover zero-downtime
  and fails cleanly; the special branch was more code and strictly worse.
- **`docker-rollout` needs no `container_name` and a reverse proxy that re-resolves.** Removing
  `container_name` lets Compose run two indexed instances sharing the service network alias; the plugin
  is a host-run shell script, so pin it to a commit SHA and verify its sha256 before `chmod +x` (treat
  it like the SHA-pinned Actions - supply chain).

## Blog subscribe / Constant Contact (spec 0018, feedback 0013)

- **A layout/visual smoke marker must be UNIQUE to the unit on that route - a Tailwind utility
  shared by chrome cannot fail.** The subscribe block was guarded by the bare class `"sm:flex-row"`,
  but the shared `footer.tsx` (and `blog-list.tsx`) emit it too, so it appeared in the HTML whether
  or not the form rendered - dropping the form or its responsive layout stayed green. This is the
  recurring "assert what the unit uniquely produces" trap (feedback 0001/0003/0006/0009, learnings
  0011) applied to a *class-based* marker. Fix: anchor on unit-unique copy (the form's own subtext)
  and a class *combination* nothing else on the route emits (`"sm:flex-row sm:items-end"`). Grep the
  other components for a utility before trusting it as a guard.
- **When copying an error-shaping pattern across integrations, re-check whether the NEW upstream's
  error body can carry PII.** The contact core throws `status + body-slice` safely because Resend's
  error body has no submitted PII; the subscribe core copied that shape, but Constant Contact's
  `sign_up_form` 4xx body can echo the submitted `email_address`, and the route logs thrown errors -
  so a subscriber's email would land in container logs. Throw status-only for that call (attach
  `err.status` for branching); keep the body only where the upstream body is known PII-free.
- **A cached OAuth access token needs a stale-token recovery path AND concurrent-mint dedup, or a
  module-scoped cache is a foot-gun.** A token invalidated upstream before its computed TTL
  (revocation, clock skew, early expiry) would otherwise 500 every request until the process
  restarts - self-heal once on a 401 (clear, re-mint, retry a single time; a second 401 surfaces,
  no loop). And memoize the in-flight refresh promise so a cold-cache burst shares one mint instead
  of N. Both paths are invisible on the warm sequential path, so unit-test them explicitly (inject a
  401-then-2xx fetch; fire N concurrent `getAccessToken` calls and assert one token call).
- **A component that renders in more than one place needs a PII-free placement dimension on its
  events.** The `blog_subscribe_*` events first carried no `source`, so listing vs. post conversions
  were indistinguishable. Thread a `source` prop (`blog_index`/`blog_post`) into every event - a
  placement label, never the address - so the two surfaces are attributable.
- **Do not re-declare styling a design-system component already owns.** The subscribe input first
  re-applied the exact Canopy focus ring via a local `RING` constant; Canopy's `Input` already ships
  it (the sibling contact form relies on the built-in). Duplicating component-owned classes diverges
  siblings and invites drift - delete it and trust the component.
- **After extracting a shared module, migrate ALL callers off the old path - do not leave a
  re-export shim as a second canonical import.** The shared HTTP guards moved to `http-guards.js`,
  but the contact route kept importing them via a `contact.js` re-export, leaving two import paths
  for the same symbols. Point every caller (route + tests) at the new module and drop the shim.

## Zero-downtime rollout OOM'd the small VM (feedback 0015)

- **A zero-downtime rollout doubles the memory footprint for the duration of the swap - size the
  host (and its cohosted neighbours) for the peak, or it causes the outage it was meant to prevent.**
  The first blue/green deploy ran two `site` instances at once (docker-rollout's N->2N overlap) on a
  ~512MB VM already running Caddy + the cohosted rogueoak app, with no swap. The box OOM-thrashed:
  `sshd` stopped answering (banner-exchange timeout, so it could not even be reached to recover),
  Caddy was left with no healthy upstream (443 connects but HTTPS hangs), and the deploy step hung
  ~11 min until the VM was rebooted from the provider console. Fix: RAM doubled to ~1GB, a 2GB swap
  file added, a generous per-service `mem_limit` (so one tenant can't starve the shared box), and a
  `timeout-minutes` on the deploy job so a wedged host fails fast. A deploy that changes runtime
  topology (container count / memory) is a CAPACITY change - verify the target's headroom before
  shipping, don't treat it as just a config edit.
- **On a cohosted box, cap each stack's memory (`mem_limit`) so one app's runaway can't take down the
  neighbour.** The OOM took the whole VM (and would have taken rogueoak with it), because nothing
  bounded either stack. A generous limit well above real usage never trips in normal operation but
  contains a leak/spike to the offending stack.

## Blog tag pages (spec 0027, feedback 0016)

- **A whole-corpus "global" fact must be computed once over the full set and passed down, never
  recomputed inside a mapper from whatever subset it is handed.** `toPostRows` derived the "New"
  badge (`newPostSlug`) from its `posts` argument. The listing passed all posts, so the badge was
  global; the tag page passed the *filtered* subset, so a post that was newest **within a tag** and
  recent rendered "New" on that tag page while carrying no badge on `/blog` - contradicting the
  code's own documented invariant. The bug was invisible on the one caller (the listing) that
  happened to pass the full set. Fix: `toPostRows(posts, newSlug)` takes the badge slug as an
  argument; both callers compute it over `getAllPosts()` and pass it. When one helper serves both a
  full-list and a filtered-list caller, hoist any whole-corpus fact to the callers.
- **A behaviour change needs a guard that can fail - again (cf. learnings 0005/0009).** Linkifying
  the post-page tag pills (acceptance #4) had no test; the tag-page smoke tests hit `/blog/tags/*`
  directly, so reverting the pills to inert `<li>` shipped green. The smoke test now fetches a post
  carrying the archive's tag and asserts `href="/blog/tags/<slug>"`. The recurring lesson: a new
  link/behaviour is only covered by a test that fetches the surface that carries it and asserts the
  behaviour, not by exercising the destination.
- **A `src/lib` module must not import a type up from `src/components`.** The row's data contract
  (`PostRowData`) first lived in `src/components/post-row.tsx` and `src/lib/post-summaries.ts`
  imported it - inverting the documented components -> lib layering (type-only, so no runtime
  coupling, but the wrong direction). The data contract belongs in the fs-free `blog-view.ts` core
  beside `deriveTags`/`filterPosts`; `post-row.tsx` re-exports it so component callers are unchanged.
- **A hook-free presentational component can be shared by a Server Component and a `"use client"`
  island** as long as it imports only client-safe modules. `PostRow` (cover thumbnail + title link +
  tags) renders in both the tag archive (server) and the listing island (client) with one markup,
  because it pulls `next/image`/`next/link`/`formatPostDate` (fs-free) and never `blog-images.ts` or
  `node:fs` - covers are resolved server-side and passed as data (learnings 0005 still holds).

## Home blog emphasis (spec 0029)

- **A "subordinate" secondary CTA is not achieved by swapping to a filled secondary variant - two
  same-size saturated solids read as co-equal.** The hero's secondary "Blog" button first used
  `variant="secondary"` (a filled bark/taupe solid) beside the filled blue primary "About me"; both
  passed AA contrast, but design review flagged that two equally-sized saturated fills compete rather
  than establishing a lead. Visual hierarchy between two adjacent CTAs comes from a *weight* contrast
  (filled vs. outline/ghost), not just a hue/token swap. Fix: a light-bordered translucent outline
  (`border-base-white/70 bg-transparent text-base-white`) - lower weight and clearly secondary. When a
  spec asks for a subordinate button, reach for a lower-weight treatment, and verify the pairing on a
  screenshot (the "does it read" question and the "does it lead" question are separate design checks).
- **A hero button over a fixed photo overlay is a white-on-dark treatment, not a theme-token one.**
  The hero background (photo + `bg-overlay/60`) does not flip with the light/dark theme, so its CTAs
  and text are always white regardless of theme - `text-base-white`/`border-base-white`, matching the
  headshot border and tagline, not `text-text`/`border-border`. A `variant="outline"` default (dark
  token border/text) would be low-contrast on the photo; override to the white-on-dark tokens. This
  makes `text-base-white` on the `/blog` anchor a unit-unique smoke marker for the hero CTA (the nav
  link is `text-text-muted`, the card link is `class="group"`, "See all posts" is a light-surface
  outline) - assert what the unit uniquely produces (recurring learning 0001/0003/0006/0009/0018).

## Resume PDF: font-size lever and the freshness-hash gap

- **The resume PDF's print root font-size lived in `globals.css`, which is NOT one of
  `generate-resume-pdf.ts`'s hashed `INPUT_FILES` - so it silently affected the PDF while
  `resume:pdf:check` stayed green.** Bumping it there would let the committed PDF drift without CI
  noticing (the exact freshness-gate-over-a-subset trap as learnings 0007). Fix: relocate the
  `@media print { html { font-size } }` rule into `theme-harbor.css`, which IS a hashed input and
  already holds the resume's `@page`/print rules. Rule of thumb, restated: any rule that changes the
  rendered PDF must live in a hashed `INPUT_FILE`; the hash must cover EVERY input that affects the
  output. (This is the mirror of learnings 0011: a rule that does NOT affect the PDF should stay OUT
  of the hashed files to avoid churn - the test is "does it change the PDF", and this one does.)
- **Scaling a rem-based document to "fill" a page is quantized by `break-inside-avoid` blocks, not
  smooth.** The whole resume scales off one `html { font-size }` (all type is rem), but the last
  experience `<article>` is `break-inside-avoid`, so it cannot be split. At 12px the content was
  ~1.7 pages (page 2 ~66% full); 13px filled page 2 to ~75% and stayed two pages, but 13.25px and
  13.5px each tipped that indivisible last block wholly onto a near-empty third page - a worse
  result than the gap it was trying to close. So "bigger font to fill page 2" has a hard ceiling at
  the point the last unsplittable block stops fitting; past it you must tighten spacing or trim
  content, not enlarge type. Always verify PDF page COUNT (not just "it rendered") when changing
  resume type size - render and read the actual PDF.

## Constant Contact: a "long-lived" refresh token still expires from inactivity

- **A long-lived CTCT refresh token is not immortal - it expires after ~180 days of NON-USE, and
  the idle clock resets only when the token is exercised.** The subscribe outage (2026-07-14) was
  the token silently expiring, not any code change. The old `subscribe.ts` comment calling the token
  "non-rotating ... nothing to persist" was half right (long-lived tokens do not rotate) but hid the
  real failure mode. CTCT keys have a Portal OAuth2 setting for *rotating* (single-use, a new
  refresh token every call) vs *long-lived* (reusable, 180-day idle expiry); this key is long-lived.
- **A lazy token mint on a low-traffic endpoint is a latent time bomb.** The route mints an access
  token only on a real subscribe, then caches it ~24h. So on a quiet blog the refresh token can go
  unused for months - deploys do not exercise it (the cache is lazy), so nothing touches it until a
  visitor subscribes, by which point it has expired and they hit a 500. Any credential kept alive
  only as a side effect of user traffic will eventually die during a traffic lull. Exercise it on a
  fixed schedule (cron), independent of traffic - `deploy/docker/refresh-ctct-token.sh`, daily.
- **Cohosted sites on one CTCT account share the account's lists, not their app credentials.** Two
  V3 keys (different `client_id`) authorized on the same Constant Contact account can each mint
  tokens that read/write the same lists - which is why the cohosted rogueoak key was a valid
  emergency stand-in for the blog list. Verify shared-account before borrowing a token: mint with it
  and `GET /v3/contact_lists/<list_id>`; a 200 with the expected list name confirms it. A refresh
  token is bound to its `client_id`, so swap the pair together, never just the token.
- **This app uses the CTCT device flow (public client, no redirect URI, no secret), so re-auth is a
  device-grant browser approval, not a code+PKCE callback.** When a refresh token is truly dead it
  cannot be refreshed - it must be re-minted by a human approving in a browser. Runbook (private):
  `context/deploy-runbook.md`.
