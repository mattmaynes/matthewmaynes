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
- **A test asserting a COLD-START behaviour must create the cold state IN THE TEST, not assume it
  and not merely reset it in a shared hook.** The prewarm test's MISS -> HIT flip needs an empty
  image cache, but `next/image` writes variants to `<serverDir>/.next/cache`, which outlives the
  server AND the reused build - so it held for exactly one run per build, then reported HIT on the
  "cold" request. Resetting in `before` only RELOCATED the assumption (environment -> declaration
  order): a sibling test warms `/` through the entry script's default routes, the same page the MISS
  check samples, so a reorder or concurrent tests bring it back. Any test keyed on a first-time
  effect (cache MISS, one-shot migration, empty table, "first request" path) owns that setup itself.
  Reset the cache ROOT, not a pinned internal subdir - `rmSync` with `force` makes a wrong path a
  silent no-op, so an upstream move re-arms the bug quietly. Note where this hides: CI builds fresh
  every job, so it was permanently green there and only ever reddened locally mid-iteration - a green
  pipeline is NOT evidence the suite is deterministic. Re-running the suite twice without rebuilding
  is the cheap check. (0027)
- **An "in this order" acceptance criterion needs a source-order assertion, not presence markers.**
  `html.includes(a) && html.includes(b)` stays green when a stack is reshuffled (a section floated to
  the top) - it only proves both rendered. Assert that each marker's byte offset increases down the
  page so a reorder reddens; anchor on the FIRST occurrence when a marker (e.g. a social URL) also
  appears later in shared chrome like the footer. (0039)
- **Test collection logic against a MULTI-ITEM fixture via a pure exported function**, not production
  data or a single item - a one-item fixture never runs the sort/filter/dedup loop, so an inverted
  comparator passes green. Assert order *and* non-mutation. (0009)
- **An exclusion rule ("hidden from every surface") needs a direct marker on EVERY surface** that
  renders the entity (listing, latest-post block, tag archive, prev/next nav, OG card, sitemap) -
  each picks its data source independently and regresses alone. (0034)
- **Encode acceptance criteria as automated assertions, not human review** - especially the public-
  site PII rule (grep the rendered HTML for any email/phone/postal, tolerating only the placeholder).
  Force creds empty so guard/error paths (4xx/5xx) run without the real upstream. (0007/0008)
- **Verify the real artifact, not that it "rendered".** A green build only proves it compiled: fetch
  the OG card and assert `200` + `image/png`, count the PDF's pages, eyeball the output. (0004)
- **A unique, failable marker can still guard the WRONG HALF of the thing.** Asserting a block's
  chrome (its title copy, its landmark name) proves it rendered, not that it still *works*: deleting
  the form inside a subscribe aside left every such marker green, and one negative assertion got
  greener. When a unit is "container + payload", assert the payload too, scoped to the container so
  another instance on the page cannot satisfy it - and assert any prop that is itself an acceptance
  criterion (an analytics `source` that distinguishes two placements is serialized into the RSC
  payload, so it is greppable; flipping it otherwise passes lint, types, and the whole suite). (0041)
- **A presence assertion cannot catch a DUPLICATION bug - for a singleton, assert the count.**
  `assert.match(html, /<h1[\s>]/)` is satisfied by one H1 and by two, so every post shipped a
  duplicate heading under a green suite. Anything a document may contain exactly once - `<h1>`, a
  canonical link, a landmark, a JSON-LD node of a given `@type` - needs `=== 1`, not "at least one".
  (0026)
- **`display:none` hides a markup defect from BOTH channels people audit by hand.** It removes the
  element from the accessibility tree, so a screen-reader pass comes back clean, and only one copy is
  on screen, so a visual pass does too - while crawlers, validators, unfurlers, and feed readers, which
  consume markup and apply no computed style, still see everything. When a component is duplicated and
  CSS-switched per breakpoint, audit the HTML SOURCE, not the rendered page. (0026)
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
- **One component/config map shared by two surfaces silently widens the NARROWER one.** The MDX map
  built for post bodies was also handed to the caption compiler, so a block-level component (a
  subscribe aside with a live `<form>`) became resolvable inside a `<figcaption>` - beyond the
  surface the authoring docs describe, and enough to break the "this marker occurs once per page"
  premise other tests rest on. When you add to a shared allowlist, enumerate every consumer; give the
  narrower surface its own subset rather than assuming authors will not reach for the extra. (0041)
- **`next/image` needs a static import to kill flicker** (so `placeholder="blur"` gets a
  `blurDataURL`), but SOURCE size dominates first paint - right-size sources first. (0005/0006)
- **Never build a redirect/absolute link from a Route Handler's `req.url`.** Behind a proxy `req.url`
  is the container's internal host, so `new URL(path, req.url)` sends the browser somewhere
  unreachable - emit a RELATIVE `Location` and let the browser resolve it against the origin it
  connected to. (Middleware's `nextUrl` honours `x-forwarded-host`; `req.url` does not.) (0021)
- **`generateStaticParams` scoping is NOT access control.** `dynamicParams` defaults to true, so an
  un-baked slug still renders on demand (more so once the route is dynamic/ISR). A per-slug
  metadata/OG route must carry the SAME runtime state guard as its page (`isPublishedNow` +
  `notFound()`), kept in lockstep with it - a hidden post excluded from the page but served by its OG
  route leaks. Each exclusion needs a failable per-surface smoke assertion (the OG-route 404 was
  untested). (0019, generalising 0017/0034)
- **Gating a whole route at the proxy also hides its OG metadata from unfurlers.** A link preview is
  built from the PAGE's `<head>`, so if a route is both access-controlled AND meant to unfurl, serve the
  metadata publicly and gate only the BODY (a page-level cookie check) - a public OG-image route alone
  is useless if the page that references it is redirected. (0022)
- **Keep test fixtures out of live content.** When a loader reads one content dir shared by prod and
  tests, sample fixtures leak onto the live site. Inject an extra dir via an env the loader reads only
  under test (set absolute by the test script), so removing samples from live content does not gut
  coverage. (0022)
- **ISR / `stale-while-revalidate` is for PUBLIC pages; a gated must-be-current view should be
  `force-dynamic`.** ISR makes Next emit a long `stale-while-revalidate`, so a browser holds a stale
  copy - fine for a public listing, wrong for a gated, low-traffic author tool (a drafts index, a
  dashboard) that must reflect reality the instant it loads. Use `force-dynamic` (`no-store`) there;
  per-request rendering behind a login is free. And when a user reports "stale content", curl the
  ORIGIN first - it is often a client/reader cache, which points at the cache-control policy, not a
  data bug. (0023)
- **Make illegal states unrepresentable:** encode "a kind + its correlated treatment" as ONE
  discriminator prop (`variant: "published" | "draft"`), not two flags that can contradict. (0034)

## Design system & tokens

- **A component whose layout switches on a VIEWPORT breakpoint (`sm:`) breaks when embedded in a
  fixed narrow column** - the breakpoint reads the window, not the container, so a `sm:flex-row` form
  in a `max-w-md` column goes to a row it has no room for and smooshes its fields. Override to the
  stacked layout with a container-scoped rule: target the internal layout class by attribute selector
  (`.wrapper [class*="sm:flex-row"]`) at higher specificity (0,2,0 beats Tailwind's 0,1,0, so no
  `!important`), scoped to a wrapper so only that embedding changes. (0025)
  **But first ask whether the narrow column is load-bearing** - this override was deleted a day
  later by #177, which dropped the block's `max-w-md` cap and gave the row the room it wanted.
  Removing the constraint beat fighting the breakpoint. (0025)
- **Deleting a fix's MECHANISM deletes its guards; the behaviour still needs one.** #177 removed the
  `.links-subscribe` override and, correctly, both tests that were specific to it - but shipped no
  replacement guard, so the entire fix came to rest on a single `max-w-2xl` class with nothing
  asserting it. Reverting that one class reproduced feedback 0025 exactly (the name field clipping to
  `"Name (opt|"`) with the full suite green. When a fix moves from mechanism A to mechanism B, the
  test moves too: re-anchor the guard on whatever now carries the behaviour, and pin the
  PRECONDITION as well (here `alwaysShowName` - with the name field collapsed there is no third
  field to smoosh, so the case quietly retires). And beware a marker that merely LOOKS like a guard:
  the form's `sm:flex-row sm:items-end` combo proves the row container shipped, but it is emitted
  identically at any container width, so it can never distinguish a well-laid-out form from a
  smooshed one. Also update the docs in the same change - #177 left spec 0039 and a smoke-test
  comment describing a mechanism that no longer existed, which is how a spec starts lying. (0025/0039)
- **Verify a token class name against the actual theme before using it** (`text-text-muted`, not
  `text-muted`) - grep the generated CSS. A wrong token renders unreadable, silently. Reach for a
  semantic role, not a raw Tailwind step; add a `@theme` role if missing and confirm it emitted. (0011/0014)
- **Reuse the design-system field seed (`Input`), never hand-roll an `<input>`.** A raw input silently
  drops the seed's error (`aria-invalid`), disabled, placeholder, and iOS-zoom-safe treatment, so the
  error state can look identical to the resting state. Hand-rolling a component the design system
  already ships is a review red flag. (0020, relating to 0017)
- **A `ChunkLoadError` is a signal to reload, not a crash to display**: a tab open across a deploy
  requests chunks the new build renamed. Detect it in the error boundary and force one guarded full
  reload onto the current build. (0018)
- **A third-party barrel that evaluates React context at module scope needs a `"use client"`
  re-export boundary**, or importing it into a Server Component fails the build. (0001/0007)

## Media & assets

- **Media in a fixed-width column needs a viewport-aware HEIGHT cap, not just a width cap.** A
  portrait or near-square image/cover at full column width is unbounded in height and takes over the
  screen on desktop. Bound the WIDTH to `height-cap * aspect` (wrapped in `min(100%, ...)`) so the
  rendered height lands on the cap with the ratio preserved and landscape media stays full width.
  Apply the SAME rule across every media type on the surface (image, cover, video) from ONE shared
  constant - the video already had a `75vh` cap the images silently lacked, so they had drifted. (0024)
- **Bake in what the client can't apply, and scrub what it shouldn't see.** A viewer can't undo what
  isn't in the pixels: rotate to upright and convert to sRGB *before* stripping metadata (stripping
  drops the EXIF orientation + colour-profile flags), and bake any CSS-effect an email client will
  discard (a `transform` ribbon) into the image itself. Conversely, scrub what travels invisibly -
  scan media for embedded GPS/location before publishing (phone video carries coordinates the sibling
  photos may not), and transcode to a broadly-supported codec.

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
- **Adding a SECOND derivation path from one source is how a generated set goes inconsistent.**
  Shipping the brand SVG as the vector favicon first copied it directly while the rasters still came
  from a PNG master rendered by a manual, documented-only `qlmanage` step: one command then produced
  a fresh vector and stale rasters, a footgun that did not exist when everything derived from a
  single master. The fix is to fold the manual step INTO the script so there is one path and one
  command, not to document the second step harder. Pair it with a CI gate that can actually run -
  when the generator needs platform-only tooling (macOS `sips`/`qlmanage`), the gate must be a plain
  byte compare (`icons:check`) so ubuntu CI can enforce freshness the generator never could. (0037)
- **A source-keyed freshness gate also trips on edits that DON'T change the output, and the
  sanctioned fix can be wrong.** A site-wide metadata sweep (adding `alternates.canonical` to every
  page) touches `src/app/resume/page.tsx` and `src/app/privacy/page.tsx` - both hashed inputs to
  freshness gates - so `resume:pdf:check` and `privacy:check` redden in CI after a green local test,
  even though the printed PDF is byte-identical and the privacy prose is unchanged (canonical is
  head-only). Before a broad per-page change, enumerate which page sources are gated and decide per
  gate: the resume gate's fix is harmless (`npm run resume:pdf`, commit the refreshed PDF + hash),
  but the privacy gate's only sanctioned fix (`privacy:stamp`) bumps the user-facing "Last updated"
  date - a FALSE signal that the policy changed - so the right move there was to leave `/privacy`
  off the sweep, not stamp it. A gate keyed on a whole file can't tell head metadata from real
  content; treat "the fix clears the check" and "the fix is honest" as separate questions. (0040)
- **A deploy that changes runtime topology (container count, memory) is a CAPACITY change** - a zero-
  downtime rollout doubles the footprint during the swap; size the host (and cohosted neighbours) for
  the peak, cap each stack's memory, and bound the deploy job so a wedged host fails fast. (0015)
- **Tests that build into a shared output dir must be serialized** - a parallel runner (`node --test`)
  lets two lazy builds corrupt one `.next`; pin `--test-concurrency=1`, and test on the runtime's
  pinned toolchain version. (0003/0006)

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
- **Classify by NATURE, not by directory, when a policy splits a repo's contents.** The licence split
  was written as a directory list, which silently put the site's *written* content under the code's
  permissive half: page prose lives in `src/app/**/page.tsx` and the resume in `src/lib/resume.ts`.
  Directory boundaries and kind boundaries do not coincide. State the rule by what the thing IS, then
  use directories as a guide and name the exceptions that live inside the wrong tree. Applies to any
  content-vs-code policy: licensing, PII scrubbing, what ships to a CDN. (0042)
- **A policy enumeration without a catch-all reads as a deliberate exclusion.** Reserving
  `public/images/` and `public/videos/` left `public/resume.pdf` unnamed - not merely un-covered, but
  arguably excluded on purpose, because listing siblings implies the omission was chosen. Any
  allow/deny list over repo contents needs a default ("anything not in A falls under B"), or the next
  directory added falls through the gap. (0042)
- **A component rendered MORE THAN ONCE must not own a singleton element.** A hero header duplicated
  for two breakpoint layouts owned the `<h1>`, so every post emitted two. When you duplicate a
  component for layout reasons, first lift anything that must appear once - the heading, an `id`, a
  landmark role - out to the single-instance parent, and leave the copies presentational
  (`aria-hidden`) so the one real element is not announced twice. (0026)
- **A LINK-shaped CTA is invisible in a funnel that attributes by form.** A form carries its own
  `source`; a link that hands off to a shared landing page inherits *that page's* source, so its
  conversions are indistinguishable from every other route to the same page - and it silently
  inflates the bucket it lands in. Autocapture is no fallback when shared chrome (a footer) emits the
  same text and href site-wide. Carry attribution in the href (`?from=<placement>`): the analytics
  client already stamps the URL on every event, so it costs no new event, no client component, and no
  change to the suppression gate. Same rule for any two placements of one control. (0041)
- **When one control is duplicated at two call sites, the second copy is where the drift lands.** A
  change made "just on this page" (a narrow-viewport collapse on one of two RSS buttons) leaves the
  same control behaving differently on the same phone. Extract on the second call site, not the
  third. (0041)

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
- **Pin supply-chain inputs to immutable identifiers** - CI Actions and host scripts to commit SHAs,
  and a pinned host key to the SAME identifier the deploy connects to (hostname vs IP), or a DNS
  cutover breaks on a key mismatch. (0002/0019)
- **A honeypot hidden field is not a free spam guard - autofill fills hidden fields, so it silently
  drops real users** (a false negative invisible to both sides). Prefer guards that can't misfire on a
  legitimate submission - same-origin + rate limit - over a hidden-field trap; when a shared component
  drops such a trap, mirror the removal in any hand-rolled forms that copied it. (0028)

## Worktree

- **Building in a nested `.worktrees/` checkout:** pin `outputFileTracingRoot` (else `server.js`
  nests under `.next/standalone/.worktrees/<slug>/` and the smoke test misses it), and give the
  worktree its OWN `node_modules` (`npm ci` or a `cp -al` hardlink; a symlink is rejected). (0002/0005)
