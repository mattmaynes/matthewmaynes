# Learnings

General, reusable rules distilled from shipped work - the kind you would apply differently next
time. Feature-specific "what we built" history lives in `features.md` / `architecture.md`, not here.
Parenthetical refs (e.g. `0012`) point at the spec/feedback that taught the lesson.

## Testing

- **Assert what the unit uniquely produces - the marker must be able to fail.** A test keyed on
  shared chrome (nav/footer text, a `<title>` a placeholder also had, a bare Tailwind utility the
  layout also emits) passes even when the unit is blank or reverted. Anchor on route-unique copy, a
  class *combination* nothing else emits, or the exact behaviour on the surface that carries it.
  Every visible/behavioural acceptance criterion needs its own failable guard in the same PR. This is
  the single most-repeated lesson here.
- **Test collection logic against a MULTI-ITEM fixture via a pure exported function**, not production
  data or a single item - a one-item fixture never runs the sort/filter/dedup loop, so an inverted
  comparator passes green. Assert order *and* non-mutation. (0009)
- **An exclusion rule ("hidden from every surface") needs a direct marker on EVERY surface** that
  renders the entity (listing, latest-post block, tag archive, prev/next nav, OG card, sitemap) -
  each picks its data source independently and regresses alone. (0034)
- **Encode acceptance criteria as automated assertions, not human review** - especially the public-
  site PII rule (grep the rendered HTML for any email/phone/postal, tolerating only the placeholder).
  Force creds empty so guard/error paths (4xx/5xx/honeypot) run without the real upstream. (0007/0008)
- **Verify the real artifact, not that it "rendered".** A green build only proves it compiled: fetch
  the OG card and assert `200` + `image/png`, count the PDF's pages, eyeball the output. (0004)
- **A new server-only secret needs a structural "absent from the client bundle" test.** Reading it
  server-side is only a convention; one `NEXT_PUBLIC_`/stray-import mistake ships it to the browser on
  a public repo. Extend the existing bundle-grep guard (the one that checks the PostHog key) to assert
  each new secret's value is absent. Likewise, a new HTTP route needs its own failable end-to-end
  smoke test - unit-testing the pure core is not coverage of the handler's cookie/redirect wiring. (0020)

## Next.js & rendering

- **`useSearchParams` forces a client bailout that EMPTIES a static page's SSG HTML.** For URL-synced
  state on a static route, read the URL through a `useSyncExternalStore` store (server snapshot = the
  default) + `history.replaceState` - the same pattern that dodges `set-state-in-effect`. (0012)
- **`Date.now()` in a Server Component render body trips `react-hooks/purity`.** Hoist to a module-
  scope `const NOW_MS = Date.now()` - evaluated once at build, which is the "as of this deploy"
  semantics you want on a static page. (0012)
- **`NEXT_PUBLIC_*` is inlined at BUILD time, not read at runtime** - a runtime-only env ships a
  keyless bundle from CI. Give it a committed default (only for a publishable value). (0014)
- **MDX via `next-mdx-remote` is build-time CODE EXECUTION, not inert content** - safe only over our
  own tracked files constrained to prose + known components. Untrusted content needs an allowlist. A
  `<PostImage>`/`<PostVideo>`-style component that throws on an unknown name fails the build loudly on
  a typo. (0009)
- **`next/image` needs a static import to kill flicker** (so `placeholder="blur"` gets a
  `blurDataURL`), but SOURCE size dominates first paint - right-size sources first. (0005/0006)
- **`next/og` (satori) cannot read woff2** - use woff/ttf/otf, loaded via `new URL(.., import.meta.url)`
  so fonts are traced into the `output: standalone` build (`src/` is not deployed; `public/` is). (0004)
- **A per-post metadata route (`opengraph-image`) needs `generateStaticParams` too**, or it goes
  dynamic and reads `content/` per request. (0009)
- **`generateStaticParams` scoping is NOT access control.** `dynamicParams` defaults to true, so an
  un-baked slug still renders on demand (more so once the route is dynamic/ISR). A per-slug
  metadata/OG route must carry the SAME runtime state guard as its page (`isPublishedNow` +
  `notFound()`), kept in lockstep with it - a hidden post excluded from the page but served by its OG
  route leaks. Each exclusion needs a failable per-surface smoke assertion (the OG-route 404 was
  untested). (0019, generalising 0017/0034)
- **Make illegal states unrepresentable:** encode "a kind + its correlated treatment" as ONE
  discriminator prop (`variant: "published" | "draft"`), not two flags that can contradict. (0034)

## Design system & tokens

- **Verify a token class name against the actual theme before using it** (`text-text-muted`, not
  `text-muted`) - grep the generated CSS. A wrong token renders unreadable, silently. Reach for a
  semantic role, not a raw Tailwind step; add a `@theme` role if missing and confirm it emitted. (0011/0014)
- **Reuse the design-system field seed (`Input`), never hand-roll an `<input>`.** A raw input silently
  drops the seed's error (`aria-invalid`), disabled, placeholder, and iOS-zoom-safe treatment, so the
  error state can look identical to the resting state. Hand-rolling a component the design system
  already ships is a review red flag. (0020, relating to 0017)
- **A page that renders its own `<html>` must run the theme script**, and it only runs in SERVER-
  rendered HTML - a client-mounted boundary (`global-error`, the error shell) must re-apply the theme
  in its effect. (0014/0018)
- **A `ChunkLoadError` is a signal to reload, not a crash to display**: a tab open across a deploy
  requests chunks the new build renamed. Detect it in the error boundary and force one guarded full
  reload onto the current build. (0018)
- **A package whose barrel evaluates React context at module scope needs a `"use client"` re-export
  boundary** (`src/components/ui.ts`), or importing it into a Server Component fails the build.
  Applies to Canopy and `@rogueoak/icons`. (0001/0007)

## Media & assets

- **Bake in what a client can't apply.** iPhone photos are portrait-via-EXIF-Orientation and Display
  P3; strip metadata for privacy AND you drop the orientation flag (image renders sideways) and the
  colour profile (P3 read as sRGB looks dull). Rotate pixels upright and convert to sRGB first, then
  strip. Email clients drop CSS `transform`, so a CSS "sash"/ribbon must be baked into the image.
- **Always scan video for embedded GPS** (`exiftool`): phone `.mov` clips carry precise coordinates
  even when the sibling photos don't. Transcode HEVC to H.264/yuv420p or non-Safari browsers won't play it.

## Build, CI & deploy safety

- **A green job can ship STALE output** - a restored cache layer, a cached page. Verify against the
  RUNNING container's output, and bust caches on a source change. (0004)
- **Verify a user-facing property at the EDGE the user hits, not the component you changed** - an
  inner healthcheck passing is not the outer routing/TLS path working. (0019)
- **Every check the deploy enforces must ALSO gate the PR; share ONE gate definition** so they can't
  drift (a required check needs branch protection to block). A silently-revertible config needs a
  PER-DEPLOY gate so a future regression fails the deploy that introduces it. (0008/0019)
- **A generated-artifact freshness gate must hash EVERY input that affects the output** (and only
  those) and regenerate from a clean build; verify the real output too, not just the hash. (0005/0007)
- **A deploy that changes runtime topology (container count, memory) is a CAPACITY change** - a zero-
  downtime rollout doubles the footprint during the swap; size the host (and cohosted neighbours) for
  the peak, cap each stack's memory, and bound the deploy job so a wedged host fails fast. (0015)
- **`node --test` runs files in PARALLEL** - two that each lazily `next build` into one `.next`
  corrupt it; serialize with `--test-concurrency=1`. Test on the runtime's pinned Node. (0003/0006)
- **Separate the browser cache from the server optimizer cache before "fixing" image caching.**
  Content-hashed assets are already immutably browser-cached; the post-deploy wait is the COLD on-
  demand optimizer, fixed by a prewarm that crawls the rendered pages. (0006)

## Architecture & seams

- **Logic that BOTH a Server Component and a `"use client"` island need lives in a pure, fs-free third
  module** (the island can't import a `node:fs`-coupled module), so `node --test` covers it with no
  build. A hook-free presentational component can be shared by both if it imports only client-safe
  modules (resolve data server-side, pass it in). (0008/0012/0016)
- **`src/lib` must not import UP from `src/components`, even a type** - shared data contracts live in
  the lib core; components re-export them. After extracting a shared module, migrate ALL callers off
  the old path (no re-export shim as a second canonical import). (0016/0018)
- **A whole-corpus "global" fact must be computed ONCE over the full set by the caller and passed
  down**, never recomputed inside a mapper from whatever subset it was handed. (0016)
- **A JS-core / TS-wrapper pair sharing a basename** (`blog.js` + `blog.ts`) resolves `./blog.js` to
  the sibling `.ts` at type-check - so a new pure-core export needs a matching typed wrapper export,
  or `next build` fails while `node --test` passes. (0011)

## Credentials, security & ops

- **A cached OAuth token needs both a stale-token self-heal** (clear + re-mint + retry ONCE on 401)
  **and in-flight-mint dedup** (memoize the refresh promise) - without both, a module cache 500s
  every request until restart or stampedes on a cold burst. (0018)
- **A credential minted lazily on a low-traffic path is a time bomb** - deploys don't exercise it, so
  it expires during a lull and the next user hits a 500. Exercise it on a cron. "Long-lived" isn't
  immortal (CTCT tokens have a ~180-day IDLE expiry; the clock resets only on use). Verify a shared-
  account assumption before relying on it; a refresh token is bound to its `client_id` - swap the pair
  together. (0018/0033)
- **Never put a secret or PII in a tracked spec/plan/feedback doc**, even as an illustration - refer
  by env-var name. Derive the rate-limit key from the proxy's ACTUAL `X-Forwarded-For` (a value the
  client can't rotate). (0008)
- **A bind-mounted config is NOT applied by `compose up -d`** - hash it across the deploy and
  explicitly `reload`/restart, and verify it reached the running config. A reverse proxy also caches a
  static upstream's resolved IP - use dynamic re-resolution to follow a container swap. (0019)
- **Pin `known_hosts` by the SAME identifier the deploy connects to** (hostname vs IP), or a DNS
  cutover breaks on a host-key mismatch. Pin Actions and host scripts to commit SHAs. (0002/0019)

## Worktree

- **Building in a nested `.worktrees/` checkout:** pin `outputFileTracingRoot` (else `server.js`
  nests under `.next/standalone/.worktrees/<slug>/` and the smoke test misses it), and give the
  worktree its OWN `node_modules` (`npm ci` or a `cp -al` hardlink; a symlink is rejected). (0002/0005)
