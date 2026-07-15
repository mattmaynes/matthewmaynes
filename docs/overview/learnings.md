# Learnings

General, reusable rules distilled from shipped work - the kind you would apply differently next time,
that outlive the change that taught them. Feature-specific "what we built" history lives in
`features.md` / `architecture.md`, not here. Parenthetical refs (e.g. `0012`) point at the spec or
feedback that taught the lesson.

## Testing

- **Assert what the unit uniquely produces - the marker must be able to fail.** A test that keys on
  shared chrome (nav/footer text, a `<title>` a placeholder also had, a bare Tailwind utility the
  layout also emits) passes even when the unit is blank, wrong, or reverted. Anchor on route-unique
  copy, a class *combination* nothing else on the surface emits, or the exact behaviour on the surface
  that carries it (not its destination). Every visible or behavioural acceptance criterion needs its
  own such guard in the same PR; a cosmetic or behaviour change with no failable marker ships green and
  regresses silently. This is the single most-repeated lesson here.
  (0001/0003/0005/0006/0009/0011/0013/0016/0018/0029)
- **Test collection logic against a MULTI-ITEM fixture via a pure exported function, not production
  data.** A single-item fixture never runs the sort/filter/dedup loop, so an inverted comparator passes
  green. Assert order *and* non-mutation. (0009)
- **An exclusion rule ("hidden from every surface") needs a direct marker on EVERY surface that renders
  the entity** - listing, "latest post" blocks, tag archives, prev/next nav, OG card, sitemap - each of
  which chooses its data source independently and regresses alone. A transitively-covered surface is not
  a substitute for a direct assertion. (0034)
- **Encode acceptance criteria as automated assertions, not human review** - especially a public-site
  PII rule (grep the rendered HTML for any email/phone/postal, tolerating only the example placeholder).
  (0007/0008)
- **Guard/error paths are testable without the happy-path dependency.** Force the creds empty so the
  suite exercises every 4xx/5xx/honeypot/cross-origin path and never calls the real upstream; give each
  rate-limit test a distinct key so they do not taint each other. (0008)
- **Exercise invisible recovery paths explicitly** - inject a 401-then-2xx to hit stale-token self-heal,
  fire N concurrent calls to hit mint-dedup; a warm sequential test never reaches them. (0018)
- **Verify the real artifact, not that it "rendered".** A green build only proves it compiled: fetch an
  OG card and assert `200` + `image/png`, count the PDF's pages, eyeball the output. (0004)
- **Fail loudly on bad input rather than shipping garbage** - an unparseable date should throw at build,
  not emit `NaN ... GMT` into a feed. (0013)
- **React SSR inserts an HTML comment between adjacent static text and an expression** (`By {name}` ->
  `By <!-- -->Name`), breaking a contiguous-substring assertion; render one interpolated node when a
  marker must stay contiguous. (0011)

## Next.js & rendering

- **`useSearchParams` forces a client-render bailout that EMPTIES a static page's SSG HTML** (only the
  Suspense fallback prerenders). For URL-synced state on a static route, read the URL through a
  `useSyncExternalStore` external store (server snapshot = the default) plus `history.replaceState` -
  the same store pattern that dodges the `set-state-in-effect` lint rule. (0012)
- **`Date.now()` in a Server Component render body trips `react-hooks/purity`.** Hoist it to a
  module-scope `const NOW_MS = Date.now()`, evaluated once at build for a static page - which is exactly
  "as of this build/deploy" semantics. (0012)
- **`NEXT_PUBLIC_*` is inlined at BUILD time, not read at runtime** - a runtime-only env ships a keyless
  bundle from CI. Give it a committed default (only safe for a publishable value). (0014)
- **MDX via `next-mdx-remote` is build-time CODE EXECUTION, not inert content** - safe only over our own
  tracked files constrained to prose + known components; untrusted/multi-author content would need
  `rehype-sanitize` or an allowlist. (0009)
- **A per-post metadata route (`opengraph-image`) needs `generateStaticParams` too**, or it goes dynamic
  and reads `content/` per request. (0009)
- **`next/image` needs a static import to kill flicker** (so `placeholder="blur"` gets a `blurDataURL`),
  but SOURCE size dominates first paint far more than AVIF-vs-WebP - right-size sources first. (0005/0006)
- **`next/og` (satori) cannot read woff2** - use woff/ttf/otf, and load fonts via
  `new URL(..., import.meta.url)` so they are traced into the `output: standalone` build (a
  `process.cwd()`-relative read of `src/` is not - `src/` is not deployed; `public/` is). (0004)
- **Make illegal states unrepresentable:** encode a "kind + its correlated treatment" as ONE
  discriminator prop (`variant: "published" | "draft"`), not two parallel flags that can contradict. (0034)

## Design system & tokens

- **Verify a token class name against the actual theme before using it** (`text-text-muted`, not
  `text-muted`; `--color-primary-foreground`, not `text-on-primary`) - grep the generated CSS/Roots. A
  wrong token renders unreadable, silently. A page that renders its own `<html>` must include the theme
  script or it ignores the visitor's theme. (0014)
- **Reach for a semantic type/colour ROLE, not a raw Tailwind step**, on a token-first codebase; add a
  `@theme` role if one is missing, and grep the built CSS to confirm it emitted (a mis-declared `@theme`
  is a silent no-op). (0011)
- **Do not re-declare styling a design-system component already owns** (focus rings, etc.) - it diverges
  siblings and invites drift. (0018)
- **Visual hierarchy between two CTAs comes from a WEIGHT contrast** (filled vs outline/ghost), not a hue
  swap; a control over a fixed photo overlay is a white-on-dark treatment, not theme tokens. Verify
  pairings on a screenshot. (0029)
- **A package whose barrel evaluates React context at module scope needs a `"use client"` re-export
  boundary** (`src/components/ui.ts`), or importing it into a Server Component fails the build with
  `createContext is not a function`. Applies to Canopy and `@rogueoak/icons`. (0001/0007)

## Build, CI & deploy safety

- **A green job can ship STALE output** - a restored build-cache layer, a re-rendered cached page.
  Verify against the RUNNING container's output, and bust caches on a source change. (0004)
- **Verify a user-facing property at the EDGE the user hits, not the component you changed.** An inner
  healthcheck passing is not the outer routing/TLS path working; they disagree exactly when it matters.
  (0019)
- **Every check the deploy enforces must ALSO gate the PR (pre-merge); share ONE gate definition**
  between PR CI and deploy so they cannot drift; a required check needs branch protection to actually
  block. (0008)
- **A load-bearing but silently-revertible config needs a PER-DEPLOY gate, not a one-time check** - so a
  future regression fails the deploy that introduces it. (0019)
- **A generated-artifact freshness gate must hash EVERY input that affects the output** (and regenerate
  from a clean build) - and ONLY inputs that affect it, or unrelated edits churn the artifact. The test
  is "does this change the output". Verify the real output too (e.g. PDF page count), not just the hash.
  (0005/0007/0011/0013)
- **A deploy that changes runtime topology (container count, memory) is a CAPACITY change.** A
  zero-downtime rollout doubles the footprint during the swap; size the host (and cohosted neighbours)
  for the peak, cap each stack's memory so one runaway can't take the box, and bound the deploy job so a
  wedged host fails fast. (0015)
- **Best-effort deploy steps must be BOUNDED** - a per-request `AbortSignal.timeout` AND a job
  `timeout-minutes`; "best-effort" means it fails fast, not just ignores errors. (0006)
- **Prefer a general tool's built-in transition over a special-cased path** (e.g. `docker rollout`'s
  health-gated overlap beats a hand-rolled `rm -f` + recreate, which reintroduces the downtime). (0019)
- **Test on the runtime's pinned Node version, not just local** - and `node --test` runs files in
  PARALLEL, so two that each lazily `next build` into one `.next` corrupt it; serialize with
  `--test-concurrency=1`. (0003/0006)
- **Separate the browser cache from the server optimizer cache before "fixing" image caching.** Content-
  hashed assets are already immutably cached in the browser; the post-deploy wait is the COLD on-demand
  optimizer, fixed by a prewarm that crawls the rendered pages (only the live HTML knows the hashed
  variant URLs), not by cache headers. Measure honestly: warm one-time init first, and send the real
  `Accept` header or you time passthrough, not the encode. (0006)

## Worktree & tooling

- **Building in a nested `.worktrees/` checkout has two traps:** pin `outputFileTracingRoot` (else the
  two-lockfile quirk nests `server.js` under `.next/standalone/.worktrees/<slug>/` and the smoke test
  misses it), and give the worktree its OWN `node_modules` (`npm ci`, or a `cp -al` hardlink - a symlink
  out of the root is rejected by Turbopack). (0002/0005/0006)

## Security & PII

- **Never put a secret or PII in a tracked spec/plan/feedback doc, even as an illustration** - refer to
  it by env-var name. On a leak reaching a pushed branch, scrub + rewrite history (amend + force-push),
  re-grep, and flag the residual exposure (reflog until GC; a non-rotatable value stays exposed). (0008)
- **Derive the client IP from the proxy's ACTUAL `X-Forwarded-For` behaviour** (ours APPENDS the real IP
  last) - a rate-limit key must be a value the client cannot rotate. (0008)
- **When copying an error-shaping pattern to a new upstream, re-check whether its error body can echo
  PII** before you log or return it. (0018)

## Credentials & integrations

- **A cached OAuth token needs a stale-token self-heal (clear + re-mint + retry ONCE on a 401) AND
  in-flight-mint dedup (memoize the refresh promise)** - without both, a module-scoped cache is a
  foot-gun that 500s every request until restart or stampedes on a cold burst. (0018)
- **A credential minted lazily on a low-traffic path is a time bomb** - deploys do not exercise it, so it
  expires during a lull and the next real user hits a 500. Exercise it on a fixed schedule (cron),
  independent of traffic. And "long-lived" is not immortal: a token can still have an IDLE expiry (CTCT:
  ~180 days of non-use, clock resets only on use). (0018/0033)
- **Verify a shared-account / shared-resource assumption before relying on it** (mint the token, GET the
  resource, confirm the expected result). A refresh token is bound to its `client_id` - swap the pair
  together, never just the token. (0033)

## Architecture & seams

- **Logic that BOTH a Server Component and a `"use client"` island need lives in a pure, fs-free third
  module**, because the island cannot import an fs-coupled module (`node:fs` breaks the client bundle).
  Keep business logic in such seams generally, so `node --test` covers it directly with no build. (0008/0012)
- **`src/lib` must not import UP from `src/components`, even a type** - shared data contracts live in the
  lib core; components re-export them for their own callers. (0016)
- **A whole-corpus "global" fact must be computed ONCE over the full set by the caller and passed down**,
  never recomputed inside a mapper from whatever subset it happens to be handed. (0016)
- **After extracting a shared module, migrate ALL callers off the old path** - do not leave a re-export
  shim as a second canonical import. (0018)
- **A hook-free presentational component can be shared by server and client renders** if it imports only
  client-safe modules (resolve covers/data server-side and pass them in). (0016)
- **A JS-core / TS-wrapper pair sharing a basename (`blog.js` + `blog.ts`) resolves a `./blog.js` import
  to the sibling `.ts` at type-check time** - so a new pure-core export needs a matching typed wrapper
  export in the `.ts`, or `tsc`/`next build` fails while `node --test` passes. (0011)

## Deploy host / ops

- **A bind-mounted config is NOT applied by `compose up -d`** - the container keeps its old config (a
  Caddyfile edit was ignored for days). Hash it across the deploy and explicitly `reload`, verify it
  reached the running config, and restart as a fallback (a long-lived process was seen to no-op a
  reload). A reverse proxy also caches a static upstream's resolved IP - use dynamic re-resolution to
  follow a container swap. (0019/cohosting)
- **Pin `known_hosts` by the SAME identifier the deploy connects to** (hostname vs IP), or a DNS cutover
  breaks the deploy on a host-key mismatch. Never `ssh-keyscan` on the fly (MITM TOFU). Pin Actions and
  host-run scripts to commit SHAs (supply chain). (0002/0019/cohosting)
