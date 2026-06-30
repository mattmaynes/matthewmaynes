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
  devDependency and derive the card fonts from it (`scripts/build-og-fonts.mjs`) rather than
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
  (`scripts/build-icons.mjs`) writes a multi-res `favicon.ico` with PNG payloads. Reproducible from
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
