# 0035 - Scheduled posts (auto-publish at a set time, no deploy)

## Problem

A finished post has two states today (spec 0034): `draft: true` (hidden, previewable under
`/blog/drafts`) or published (live everywhere). There is no way to say "publish this at 7pm" and walk
away. The blog is fully static - every public surface (`/blog` listing, home latest, `/subscribe`,
`GET /blog/feed.xml`, `GET /sitemap.xml`, tag pages, each `[slug]` page + its OG card) is baked at
build from `getPublishedPosts()`, and the RSS feed is `force-static`. So even if a post were gated by
a future date, nothing on the live site would change until the next deploy - the post would miss its
time, or a manual deploy would be required at exactly the right moment. The immediate trigger: "Life
Log #1" needs to go live at 2026-07-19 19:00 EDT, hands-off.

## Outcome

- **A `publishAt` timestamp.** A post may carry `publishAt: <ISO 8601 datetime>` in frontmatter. Absent
  = behaves exactly as today (published unless `draft: true`). Present and in the future = the post is
  **scheduled**: hidden from every public surface until that instant. Present and in the past = published.
- **Three visibility states, one derived value.** A post is exactly one of: **draft** (`draft: true`),
  **scheduled** (not draft, `publishAt` in the future), or **published** (everything else). `draft`
  wins over `publishAt` (a draft is never "scheduled").
- **Auto-flip at the time, no deploy.** At `publishAt` the post appears on `/blog`, the home latest
  slot, `/subscribe`, the RSS feed, the sitemap, its tag pages, and its own `/blog/<slug>` page **on
  its own**, within a small revalidation window (target: <= ~1 min after the first request past
  `publishAt`). No push, no build, no human action.
  - **ISR semantics (important):** Next revalidation is *request-triggered*, not a wall-clock timer -
    the flip happens on the first request after the window expires (stale-while-revalidate), so on a
    zero-traffic minute nothing regenerates until someone visits. For a hard "live at T regardless of
    traffic" guarantee, a tiny scheduled ping at T triggers the regeneration; that ping is optional
    and lives outside this spec (a cron/one-shot), not in the app.
- **Never early.** Before `publishAt` the post is absent from every public surface and its
  `/blog/<slug>` 404s - identical to a draft's public invisibility. It does not leak into the feed,
  sitemap, or "New" badge.
- **Previewable before it is live.** A scheduled post is previewable under the existing not-yet-public
  area at `/blog/drafts/<slug>` (reused; see Approach), rendered with the full post treatment plus a
  **"Scheduled for &lt;date/time&gt;"** marker, `noindex`. The `/blog/drafts` index lists drafts **and**
  scheduled posts, each with its own marker.
- **Publishing is time, not a second edit.** Once `publishAt` passes, the post moves to `/blog/<slug>`
  and every public surface automatically; no file edit, no deploy. Removing `publishAt` (or setting it
  in the past) publishes immediately on the next revalidation/deploy.

## Scope

**In**

- `publishAt?: string` on `Frontmatter` and `Post`; parsed in `parseFrontmatter`/`readPost` as a raw
  ISO 8601 string (validated parseable; a bare `YYYY-MM-DDTHH:MM` with no offset is treated as **UTC**
  and that is documented in the authoring template). Optional, so no existing post breaks.
- A pure time predicate + state helper in `blog.ts`:
  - `postState(post, nowMs): "draft" | "scheduled" | "published"`.
  - `getPublishedPosts(nowMs = Date.now())` - **now time-aware**: excludes drafts **and** posts whose
    `publishAt` is in the future. Default arg keeps every existing call site working.
  - `getScheduledPosts(nowMs = Date.now())` - not draft, `publishAt` in the future, newest-first.
  - `getPreviewPosts(nowMs = Date.now())` - the not-yet-public set = drafts + scheduled (what the
    `/blog/drafts` index and preview routes enumerate). `getDraftPosts()` stays as the draft-only set.
  - All pure derivations of `getAllPosts()`, unit-tested over a **multi-item, fixed-clock** fixture
    (learnings 0009): assert a scheduled post is excluded before its time, included after, order
    preserved, and non-mutation.
- **ISR on every public surface** so the flip happens without a deploy. A shared
  `BLOG_REVALIDATE_SECONDS` constant (60) exported from `blog.ts`; each surface sets
  `export const revalidate = BLOG_REVALIDATE_SECONDS`:
  - `/blog` listing (`page.tsx`), home (`app/page.tsx`), `/subscribe` (`page.tsx`), sitemap
    (`sitemap.ts`), tag pages (`tags/[tag]/page.tsx`), the published `[slug]` page + its
    `opengraph-image.tsx`.
  - `GET /blog/feed.xml`: replace `export const dynamic = "force-static"` with
    `export const revalidate = BLOG_REVALIDATE_SECONDS` so the feed re-bakes and the scheduled post
    enters it at its time (the RSS half of "not live early, live on time").
- **Request-time clock without tripping purity.** The time read lives in the `blog.ts` seam (a plain
  module, not a component), via the `Date.now()` default arg on the helpers above - so pages call
  `getPublishedPosts()` with no `Date.now()` in a Server Component render body (learnings 0012). Each
  ISR re-render re-invokes the helper and re-reads the clock.
- The published `[slug]` page/route already 404s a draft; extend the guard to 404 a **scheduled**
  (not-yet-due) post too, so a slug is served from exactly one place at any instant. `dynamicParams`
  stays default-`true`, so once due the on-demand render succeeds and revalidation refreshes the
  earlier 404.
- Preview surface reuses `/blog/drafts` (no new route tree): its index maps `getPreviewPosts()` (each
  row marked Draft or Scheduled); `/blog/drafts/[slug]` `generateStaticParams` enumerates
  `getPreviewPosts()`, renders a scheduled post with `variant="scheduled"` and a "Scheduled for
  &lt;when&gt;" marker, and 404s a genuinely-published slug.
- Extend the `post-article.tsx` discriminator `variant: "published" | "draft" | "scheduled"` (one
  prop, illegal states unrepresentable - learnings 0034); the scheduled marker shows the formatted
  `publishAt`. A small shared `formatPublishAt` in `blog-view.ts` (client-safe, like `formatPostDate`).
- Author docs: note `publishAt` in `docs/templates/blog-series-post.mdx` / the blog rules and the tz
  convention.
- Unit + smoke coverage (see Approach).

**Out**

- **Auth on previews** - still reachable-by-URL, exactly as drafts are today. Locking down the
  not-yet-public area (drafts + scheduled) is spec 0036 (the login gate), a separate PR.
- Sub-minute precision. The flip is bounded by the 60s revalidation window and is request-triggered;
  "7pm" means "live within ~a minute of the first request past 7pm". A tighter SLA (on-demand
  revalidation webhook, scheduled deploy) is out.
- A distinct `/blog/scheduled` route tree, a per-scheduled-post countdown UI, or auto-sending the
  series announcement email at publish time (that stays the manual `ctct` flow).
- Timezone-picker UX / per-post tz field beyond "ISO 8601 string, bare = UTC".
- **A new tag introduced ONLY by a scheduled post has no archive page until the next build.** Tag
  pages keep `dynamicParams = false` (spec 0027), so `/blog/tags/<new-tag>` 404s until a build bakes
  it; a tag the scheduled post SHARES with a published post already has a page that fills in on
  revalidation. Accepted limitation, noted in code and here.

## Approach

- **Parsing.** In `parseFrontmatter`, recognise `publishAt` alongside the known keys and keep it as a
  trimmed string; in `readPost` carry it onto `Post`. Validate it parses (`Number.isNaN(Date.parse())`
  throws a loud build error, like a bad required field) so a typo fails the build, not silently
  publishes. Not a required field.
- **One predicate, three sets.** `postState` is the single source of truth:
  `draft` -> "draft"; else `publishAt && Date.parse(publishAt) > nowMs` -> "scheduled"; else
  "published". The three getters are thin filters over `getAllPosts()` keyed on `postState`, so the
  newest-first order is inherited and they are covered by a mixed fixture at a **fixed** `nowMs`
  (deterministic; no wall-clock in tests).
- **The whole hiding/flipping mechanism is: time-aware `getPublishedPosts()` + ISR.** Every public
  enumerator already reads `getPublishedPosts()` (spec 0034 pointed them all there) - making that
  function time-aware means a scheduled post simply is not in the set until its time, on every
  surface at once. ISR (`revalidate`) is what lets "its time" take effect on the live server without a
  deploy: each surface re-renders on the interval and re-runs the now-time-aware filter. The RSS feed
  moves from `force-static` to the same `revalidate` for the same reason.
- **"New" badge / tag derivation** are computed by the caller over the time-aware **published** set
  (learnings 0016), so a scheduled post gets no "New" badge before it is live and does earn it right
  after (its `date` is recent).
- **Preview reuse.** Rather than a parallel `/blog/scheduled` tree, the not-yet-public area at
  `/blog/drafts` broadens from "drafts" to "drafts + scheduled" - the index heading/copy says as much,
  rows carry a Draft/Scheduled marker, and both kinds render through the shared `post-article.tsx`.
  This keeps one preview surface for spec 0036 to gate with a single path prefix, and avoids a second
  route + reserved-slug analysis.
- **Purity + determinism.** Impurity (`Date.now()`) is confined to `blog.ts` helper default args; the
  RSS `lastBuildDate` stays "newest published post's date" so it updates naturally when a scheduled
  post becomes newest, with no `Date.now()` in the builder (unit tests stay deterministic).
- **Tests.**
  - Unit (fixed clock, mixed fixture): `postState` returns draft/scheduled/published correctly across
    a boundary; `getPublishedPosts(now)` excludes a future post and includes it once `now` passes it,
    order preserved, non-mutating; `getScheduledPosts`/`getPreviewPosts` partition correctly;
    `parseFrontmatter` reads `publishAt` and throws on an unparseable value.
  - Feed: `buildBlogFeed` over a set that excludes a still-scheduled post's URL/title; a separate case
    with `now` past `publishAt` includes it.
  - Smoke (must be able to fail - learnings 0001/0003): a post scheduled in the **future** is absent
    from `/blog`, the feed, and 404s at `/blog/<slug>`, but 200s at `/blog/drafts/<slug>` with a
    "Scheduled" marker + `noindex`; a post with `publishAt` in the **past** is present on `/blog` and
    in the feed and 200s at `/blog/<slug>`. (A time-travel test drives `postState` with an injected
    clock, not the wall clock.)
  - Confirm each listed surface carries `export const revalidate` (a grep-able guard), so the flip
    mechanism can't silently regress to fully-static.

## Acceptance

- [ ] A post with `publishAt` in the future is absent from `/blog`, home latest, `/subscribe`,
      `GET /blog/feed.xml`, `GET /sitemap.xml`, every tag page, and the "New" badge, and `/blog/<slug>`
      404s - while `/blog/drafts/<slug>` 200s with a visible "Scheduled for &lt;when&gt;" marker and
      `noindex`, and `/blog/drafts` lists it marked Scheduled.
- [ ] Advancing the clock past `publishAt` (via the injected-clock test and, in prod, the ~5-min
      revalidation) makes the post appear on `/blog` and in the feed and 200 at `/blog/<slug>`, with no
      deploy and no file edit.
- [ ] `draft: true` still wins: a draft is never "scheduled" regardless of `publishAt`.
- [ ] Existing posts (no `publishAt`) are unchanged; `getPublishedPosts()` with no arg still works
      everywhere it is called.
- [ ] `postState`, the three time-aware getters, and `publishAt` parsing have unit tests over a
      multi-item **fixed-clock** fixture; the feed test proves both exclusion (before) and inclusion
      (after).
- [ ] Every public surface listed in Scope sets `export const revalidate`; the RSS route no longer
      uses `force-static`.
- [ ] `npm run lint`, `npm test`, `npm run build` green; smoke covers a future-scheduled post
      (hidden + preview marker + 404) and a past-scheduled post (live + feed + 200).
