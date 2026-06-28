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
