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
