# 0018 - Blog email subscribe (Constant Contact)

## Problem

The blog can be read but not **followed**. A visitor who finishes a post or scans
the listing has no way to be told when the next one lands - they must remember to
come back, or rely on the RSS feed (spec 0013), which most readers do not use. There
is no owned channel to reach interested readers directly.

Matthew now has a Constant Contact account with a dedicated **"Matthew Maynes Blog"**
contact list, and the site's deploy host already holds a long-lived, non-rotating
Constant Contact OAuth credential (client id + refresh token) plus the target list id,
bootstrapped once via the device flow and stored server-side only. Nothing in the app
reads them yet - this spec is what turns that credential into a working subscribe box.

The same hard constraint as the contact form applies: **this repo is public**
(`CLAUDE.md`). The Constant Contact client id, refresh token, and list id are secrets
that must never appear in tracked files, git history, or anything shipped to the
browser - they live only in the runtime environment (`deploy/docker/.env.site`,
already `chmod 600` and git-ignored). And because the endpoint is a public POST, it is
a spam magnet the moment it ships, exactly like `/contact` - so the same launch-safe
spam guards are in scope here, not a follow-up.

## Outcome

A reader sees a **"Subscribe for updates"** block with an email input and a Subscribe
button, at the bottom of the blog **listing** page and immediately after the **content**
on each blog **post** page. They type an email, click Subscribe, and see inline
confirmation (or a clear error). Their address is added to the "Matthew Maynes Blog"
list in Constant Contact (created or updated - resubmitting the same address is
idempotent, not an error). The Constant Contact credentials appear in no tracked file,
git history, client bundle, or rendered HTML - only in runtime env. Obvious bot spam
(honeypot-filled, cross-origin, or a burst from one client) is dropped before it ever
calls Constant Contact.

The block is **mobile responsive**: on narrow viewports the input is full width and the
Subscribe button stacks full width beneath it; at `sm` and up the input and button sit
inline on one row (input flexes to fill, button hugs its label). The "Subscribe for
updates" title sits above both.

**Progressive optional name capture.** By default the box stays exactly as above. When the
reader **focuses the email field**, a single optional **"Name"** field is revealed directly
below the email, between it and the Subscribe button. Providing a name is optional - an
empty name subscribes exactly as before. When a name is given it is split on the first
whitespace run: the first token becomes the contact's **first name** and the remainder (if
any) the **last name**, both stored on the Constant Contact contact so later emails can be
personalized. This is a low-friction way to capture a bit more without a heavier form, and
applies to every placement of the box.

**Reveal keeps the row inline at `sm+` and animates.** Revealing the Name field does **not**
reflow the row on a wide screen: at `sm` and up the email input shortens and the Name field
appears **between** the email and the Subscribe button, and the button does not move; below
`sm` the fields stack. The reveal is **animated** (~200ms, eased): the field grows
horizontally on `sm+` (the button slides over) and vertically below `sm` (it expands
downward, pushing the button down), so it reads as a smooth reveal rather than a jump.
Reduced-motion users get an instant reveal. While collapsed the Name field is out of the tab
order and the accessibility tree, restored when revealed.

**Success renders as an in-place badge.** On a successful subscribe, the email/name fields
and the Subscribe button are **replaced in place** by a compact, badge-shaped confirmation
("You are on the list" with a check glyph), roughly button-sized, so the outcome reads at a
glance and the form no longer invites a second submit. The badge carries `role="status"` and
**animates in** with a subtle fade + slight scale-up (~200ms ease-out, matching the
name-field reveal); reduced-motion users get it instantly. The error state stays an inline
message below the row.

**A dedicated, shareable `/subscribe` page.** Beyond the two blog surfaces, a focused
`/subscribe` landing page leads with the ask: a page heading, a short invitation, and the
subscribe form showing **all three fields** (email, name, button) up front. Below it, the
**latest post** ("Latest post") as a card - cover, title, excerpt, date, reading-time-style
metadata, and the post's **tags** (matching the listing row) - and a **See all posts** button
to `/blog`. The page is **not** in the top nav but the shared nav/footer render (it uses the
root layout), and it **is** listed in the sitemap so the URL is crawlable/shareable. If the
content dir is empty, the Latest-post block is omitted.

## Scope

In:
- A `"use client"` `src/components/subscribe-form.tsx`: a "Subscribe for updates"
  heading, one email `Input`, a Subscribe `Button`, a honeypot field, and an
  idle / submitting / success / error status machine - modeled on
  `src/components/contact-form.tsx`. Canopy inputs come through `@/components/ui`
  (the client boundary, learnings 0001), never from `@rogueoak/canopy/*` directly. It
  takes an `alwaysShowName` prop (Name visible from first paint, for the dedicated page)
  and a `heading` prop (default true, so the dedicated page can supply its own copy).
- **Responsive layout**: stacked and full-width below `sm` (input full width, button
  full width beneath); inline single row at `sm+` (input `flex-1`, button auto width).
- **Progressive name field**: an `expanded` state, set true on email focus (and kept true
  so it stays clickable), reveals an optional "Name" `Input` between the email and the
  button. The row stays **inline at `sm+`** when expanded (container always
  `flex-col gap-3 sm:flex-row sm:items-end`; email `sm:flex-[2]`, Name `sm:flex-1`, button
  `sm:w-auto`) - it never switches to `flex-col` at `sm+`, so the button does not move;
  below `sm` the fields stack. DOM order stays email -> Name -> button so Name renders
  between them. Default (unexpanded) layout is unchanged. The Name field has an accessible
  "Name (optional)" label, `autoComplete="name"`, `maxLength={100}`, and the shared
  focus-ring. Submit sends `{ email, name, company }`; an empty `name` is fine.
- **Animated name reveal.** The Name field stays in the DOM and collapses via size +
  opacity (not `display`, which can't transition): always `sm:flex-1` / `w-full` with
  `overflow-hidden` and `transition-all duration-200 ease-out`; collapsed clamps it to zero
  on the axis that matters (`max-h-0` mobile, `sm:max-w-0` desktop, `opacity-0`), revealed
  releases it (`max-h-24` / `sm:max-w-md`, `opacity-100`). Revealing animates the button
  sliding over (desktop) or the field growing down (mobile). `motion-reduce:transition-none`
  gives an instant reveal. While collapsed the input is out of tab order + a11y tree
  (`aria-hidden` + `tabIndex=-1` + `pointer-events-none`), restored when revealed.
- **In-place success badge.** On `status === "success"` the input row (email + animated Name
  field + Button) is swapped for a single `role="status"` badge - an `inline-flex` pill
  (`rounded-full`, `px-4 py-2` ~ the Button's height) with a `Check` glyph + "You are on the
  list" text in the success tokens (`text-success` on `bg-success/10` with `border-success/30`).
  `Check` is imported directly from `@rogueoak/icons` (fine inside the `"use client"` island).
  The badge **animates in** via a `@keyframes subscribe-badge-in` (opacity 0 -> 1,
  `scale(0.96) -> scale(1)`) + `.subscribe-badge-enter` class in `src/styles/globals.css`
  (the Tailwind entry, not `theme-harbor.css`, so the resume-PDF freshness hash is untouched -
  learnings 0011), with a `prefers-reduced-motion: reduce` block setting `animation: none`. A
  freshly-mounted node has no from-state, so this is a keyframe, not a transition. The old
  below-form success `<p>` is removed (the badge subsumes it); the error state is unchanged.
- **Placement** on three surfaces, all server components rendering the client island:
  - Blog **listing** `src/app/blog/page.tsx` - after the `<BlogList>` block, before
    `</section>`, at the container's `max-w-[1200px]` width.
  - Blog **post** `src/app/blog/[slug]/page.tsx` - immediately after the MDX content
    (`<PostBody>`), inside the `max-w-4xl` article (default order: content -> subscribe ->
    disclaimer -> prev/next -> nav; see spec 0021 for prev/next).
  - Dedicated **`/subscribe`** page (see below), which renders the form with
    `alwaysShowName heading={false}`.
- **Dedicated `/subscribe` page** (`src/app/subscribe/page.tsx`): a Server Component with a
  page-level H1 + invitation copy, then `<SubscribeForm source="subscribe_page" alwaysShowName
  heading={false} />`, then the newest post (`getAllPosts()[0]`, cover resolved server-side via
  `getBlogImage`) as a "Latest post" card showing cover, title, excerpt, date, and the post's
  **tags** (the same rounded chips the listing row uses), and a "See all posts" button to
  `/blog`. Empty content dir -> the Latest-post block is omitted. `alwaysShowName` seeds
  `expanded` true so the three-field inline layout is in the SSR HTML.
- **Sitemap.** Add `/subscribe` to `src/app/sitemap.ts` (the top nav stays unchanged - no
  Subscribe link). A shareable landing page benefits from being crawlable.
- A **versioned API route** `POST /v1/subscribe` (`src/app/v1/subscribe/route.ts`):
  only `POST` exported (other methods auto-405). It applies the same guards as
  `/v1/contact` (same-origin 403, body-size 413, JSON-parse 400, honeypot silent 200,
  validation 400, per-IP rate limit 429), then submits to Constant Contact and returns
  `{ ok: true }` (or a generic 500 that never leaks which config/step failed).
- A pure, unit-tested `src/lib/subscribe.js` (plain JS + JSDoc, `node --test`-able
  without a server): `validateSubscribe` (email required, shape, length cap; **optional
  `name`, trimmed + length-capped** - amendment); a pure **`splitName(name)` ->
  `{ firstName?, lastName? }`** (trim/collapse, split on first whitespace, each capped at
  the Constant Contact 50-char field limit, empty parts omitted - amendment);
  `buildSignUpPayload(email, listId, { firstName, lastName })` producing the Constant
  Contact `contacts/sign_up_form` body, **adding `first_name`/`last_name` only when present**
  (so a nameless signup yields the identical payload as before - amendment);
  `refreshAccessToken(...)` (mint a bearer token from the refresh token); and
  `submitSubscription(...)` (refresh-then-POST, now threading the split name), all with
  injectable `fetch`/`now` so the network is mocked in tests.
- **Reuse, do not duplicate**, the generic guards from `src/lib/contact.js` -
  `createRateLimiter`, `isHoneypotFilled`, `isSameOrigin` (they carry no
  contact-specific assumptions). See Approach for the import-vs-extract trade-off.
- **Access-token handling**: mint a 24h access token from the refresh token on demand
  and cache it in module scope until shortly before expiry, so a burst of submits does
  not hammer the auth server. Safe because the refresh token is **non-rotating**
  (verified at bootstrap) - a refresh returns a new access token but the same refresh
  token, so there is nothing to persist.
- A **PII-free** PostHog conversion event on success (outcome only, never the address),
  gated by `clientAnalyticsEnabled()`, with the form wrapped in `ph-no-capture` -
  mirroring the contact form (learnings feedback 0011). The submit event also carries a
  PII-free **`has_name`** boolean (whether a name was provided) and a `source`
  (`blog_index`/`blog_post`/`subscribe_page`) - never the name or email itself.
- Secret wiring **documentation**: add `CTCT_CLIENT_ID`, `CTCT_REFRESH_TOKEN`,
  `CTCT_LIST_ID` as empty, commented placeholders in `.env.example` (server-only, never
  `NEXT_PUBLIC_`). The live values already exist in `deploy/docker/.env.site` on the
  host; `compose.site.yml` already reads that `env_file`, so no compose change is needed.
- Tests: unit tests for `src/lib/subscribe.js` (validation, payload shaping, token
  refresh, submit success/failure) with `fetch` mocked, **plus `splitName` edge cases
  (one/two/three+ tokens, extra spaces, empty, over-length) and `buildSignUpPayload`
  emitting/omitting `first_name`/`last_name` (amendment)**; a smoke assertion that the
  subscribe block renders on **both** the listing and a post page (anchored on
  subscribe-unique copy that can actually fail); guard-path tests (403/400/429/
  honeypot-200) that run with the Constant Contact creds forced empty.

Out:
- CAPTCHA / Turnstile - honeypot + rate limit + same-origin cover launch (same call as
  0008). Add a challenge later only if bots get through.
- A durable/shared rate-limit or token store (Redis, etc.). One container, low traffic;
  the in-process limiter and in-memory token cache reset on restart by design.
- A managed **preferences / unsubscribe** UI in-app. Constant Contact hosts unsubscribe
  and manages consent state; the site only adds contacts.
- Any **double opt-in** flow built in-app. If confirmed opt-in is wanted, it is a
  Constant Contact account setting, not app code (noted under Compliance).
- Editing the running secret file or restarting the container - the credential is
  already in place; this spec ships the code that reads it.
- A newsletter **composer** / sending campaigns. This captures subscribers only.

## Approach

**Interface - `POST /v1/subscribe`, mirroring `/v1/contact`.** A Route Handler at
`src/app/v1/subscribe/route.ts` exports only `POST`. It reads the JSON body
(`{ email, company }`, `company` = honeypot), runs the same guard ladder as the contact
route in the same order (same-origin -> content-length -> JSON parse -> honeypot ->
validate -> rate limit), then calls `submitSubscription`. Returns `{ ok: true }` on
success; `400` validation, `413` oversized, `429` rate-limited, `403` cross-origin,
`500` config/send failure; a honeypot hit returns `200 ok` silently. The client IP for
the limiter is the **last** `x-forwarded-for` entry (Caddy appends the real client IP -
learnings feedback 0009); reading `[0]` would let a bot rotate a forged prefix. A fresh
module-scoped `createRateLimiter({ max, windowMs })` instance lives in this route.

**Send - Constant Contact v3, `fetch`, no SDK** (matching the repo's no-new-dependency
habit). Two calls, both plain `fetch` with `AbortSignal.timeout`:
1. **Token**: `POST https://authz.constantcontact.com/oauth2/default/v1/token` with
   `grant_type=refresh_token`, `refresh_token=CTCT_REFRESH_TOKEN`,
   `client_id=CTCT_CLIENT_ID` (public client - device-flow app, no client secret).
   Returns a 24h bearer `access_token`. Cached in module scope with its expiry; reused
   until a small skew before expiry, then re-minted. The refresh token is non-rotating,
   so nothing is persisted back.
2. **Add contact**: `POST https://api.cc.email/v3/contacts/sign_up_form` with
   `Authorization: Bearer <access_token>` and body `{ email_address, create_source:
   "Contact", list_memberships: [CTCT_LIST_ID] }`. `create_source: "Contact"` marks it
   as visitor self-signup (contrast the earlier manual `"Account"` bootstrap). This
   endpoint is create-or-update, so a repeat email returns success, not a duplicate
   error - matching the idempotent Outcome.

The route **fails closed**: if `CTCT_CLIENT_ID` / `CTCT_REFRESH_TOKEN` / `CTCT_LIST_ID`
are unset, or either Constant Contact call is non-2xx, it returns a generic error +
`console.error` server-side, never echoing which var or step failed to the client.

**Shared-guard trade-off (architect review point).** `createRateLimiter`,
`isHoneypotFilled`, and `isSameOrigin` already exist in `src/lib/contact.js` and are
fully generic. Default here: **import them** from `@/lib/contact` into `subscribe.js`
and the route - zero churn to a working, tested feature, at the cost of a
`subscribe -> contact` module dependency that is really "subscribe depends on shared
http guards that happen to live in contact.js". The alternative - extract the three into
a neutral `src/lib/http-guards.js` that both features import - is cleaner boundary-wise
but edits the shipped contact path. Proposed: import now, and extract to a shared module
only when/if a third consumer appears (avoid premature abstraction). Flagged for the
architect persona to confirm the call.

**Component + responsive layout.** `subscribe-form.tsx` is `"use client"`, imports
`Button, Input, FormField*` from `@/components/ui`, and holds an
`idle | submitting | success | error{message}` status machine like `contact-form.tsx`.
`handleSubmit` `preventDefault`s, POSTs JSON to `/v1/subscribe`, and branches on
`res.ok && json.ok`. Submitting disables the button and swaps its label to
"Subscribing..."; error renders `role="alert" text-danger` (the same token the contact
form uses). The honeypot is the hidden `company` field. Layout: a flex container that is
`flex-col gap-3 sm:flex-row sm:items-end` - stacked and full-width below `sm` (input
`w-full`, button `w-full` beneath), inline at `sm+` (input `sm:flex-[2]`, button
`sm:w-auto`). Reuse the existing focus-ring `RING` string convention.

**Progressive name reveal (inline at `sm+`, animated).** An `expanded` state goes true on
email focus and stays true. The Name field is always in the DOM; its wrapper is `overflow-
hidden transition-all duration-200 ease-out` and toggles between a collapsed state
(`max-h-0` / `sm:max-w-0`, `opacity-0`, plus `aria-hidden` + `tabIndex=-1` +
`pointer-events-none`) and a revealed state (`max-h-24` / `sm:max-w-md`, `opacity-100`,
`sm:flex-1`). Because the field is width-clamped (`max-w`) rather than `display`-toggled, the
row never switches to `flex-col` at `sm+`: on desktop the reveal widens the field and slides
the button over; on mobile the `max-h` grow pushes the button down. `sm:max-w-md` is a cap
wider than the field's real flex width, so it bounds the animation without clipping.
`motion-reduce:transition-none` gives reduced-motion users an instant reveal. DOM order stays
email -> Name -> button, so Name renders between them. `alwaysShowName` seeds `expanded` true
so the dedicated page ships the three-field inline layout in its SSR HTML (which is exactly
where the inline-fix and revealed markers are smoke-guarded).

**Success badge (in-place, animated entrance).** The input row is wrapped in a
`status.kind === "success"` ternary: on success it is swapped for a single `role="status"`
badge so the announcement and visual land together and the fields/button leave the DOM. The
badge is an `inline-flex` pill (`rounded-full`, `px-4 py-2` ~ the Button's height) with a
`Check` glyph + "You are on the list" in the success tokens (`text-success` on `bg-success/10`,
`border-success/30`); `inline-flex` keeps it button-sized rather than stretching. Its entrance
is a **keyframe** (a freshly-mounted node has no from-state to transition from):
`@keyframes subscribe-badge-in` (opacity 0 -> 1, `scale(0.96) -> scale(1)`) + a
`.subscribe-badge-enter` class in `globals.css` (the Tailwind entry, not `theme-harbor.css`,
so the resume-PDF hash is untouched - learnings 0011), with a `prefers-reduced-motion: reduce`
block setting `animation: none`. 0.2s ease-out matches the name-field reveal so the form's
motion reads as one language.

**Dedicated `/subscribe` page.** A Server Component: page-level H1 + invitation copy, then
`<SubscribeForm source="subscribe_page" alwaysShowName heading={false} />`, then the newest
post (`getAllPosts()[0]`, cover resolved server-side via `getBlogImage`) as a "Latest post"
card with the post's tags (the same chips the listing row shows) and a "See all posts" button
to `/blog`. Empty content dir -> the Latest-post block is omitted. `/subscribe` is appended
explicitly to the sitemap (it is intentionally not in `nav`, which drives the header + the
rest of the sitemap); a shareable landing page benefits from being crawlable, unlike
`/projects` (an in-progress stub).

**Analytics.** On success, fire a PII-free event (e.g. `blog_subscribe`, outcome only)
via the same `clientAnalyticsEnabled()` gate and `ph-no-capture` wrapper the contact
form uses, so the address is never captured in autocapture or replay (learnings
feedback 0011). Track the conversion explicitly since the masked form will not autocapture.

**Compliance (security/consent).** Matthew is in Canada, so CASL applies to sending the
resulting email. The subscribe box carries clear, visible intent ("Subscribe for
updates") so submitting is express consent, and Constant Contact owns the unsubscribe
link and consent record on every send. If confirmed (double) opt-in is desired, it is a
Constant Contact account setting, not app code (kept out of scope). No consent state is
stored in the app.

**Config - three server-only env vars, none `NEXT_PUBLIC_`:** `CTCT_CLIENT_ID`,
`CTCT_REFRESH_TOKEN`, `CTCT_LIST_ID`. Documented as empty placeholders in `.env.example`;
live values already in the host's git-ignored `.env.site` (read by `compose.site.yml`);
local dev uses `.env.local`. No secret enters git; no new GitHub secret (image reads env
at runtime). The literal values are **not** written in this spec (learnings feedback
0009 - a public spec must never carry a secret, not even as illustration).

**Docs (step 6):** add the subscribe capability to `features.md`; fold the Constant
Contact token-refresh + sign_up_form flow and its secret wiring into architecture.md's
"Configuration & secrets"; capture any friction as a learning.

## Acceptance

- [ ] A "Subscribe for updates" block (title + email input + Subscribe button) renders
      at the bottom of `/blog` (after the list, full container width), immediately after
      the content on each `/blog/[slug]` post page, and on the dedicated `/subscribe` page.
- [ ] Responsive: below `sm` the input is full width and the button stacks full width
      beneath it; at `sm+` they sit inline on one row (input flexes, button auto width).
      Asserted by a smoke marker that can actually fail if the layout classes are removed.
- [ ] Submitting a valid email calls `POST /v1/subscribe`, which mints a Constant
      Contact access token from the refresh token and POSTs `contacts/sign_up_form` with
      the email and `CTCT_LIST_ID`, returning `{ ok: true }`; the UI shows success.
      Resubmitting the same address still succeeds (idempotent). Other HTTP methods 405.
      (Constant Contact calls mocked in unit tests; one real end-to-end signup confirmed
      manually before merge, verifying the contact lands in the "Matthew Maynes Blog"
      list.)
- [ ] The Constant Contact client id, refresh token, and list id appear in **no** tracked
      file, git history, client bundle, or rendered HTML - only runtime env. `grep` for
      them in the repo and built client output finds nothing.
- [ ] Guard paths: honeypot-filled -> 200 `ok` with no Constant Contact call; missing/
      invalid/oversized email -> 400/413; burst from one IP -> 429; cross-origin POST ->
      403. All exercised with the Constant Contact creds forced empty (they return before
      the send), each rate-limit test given a distinct `x-forwarded-for`.
- [ ] Missing `CTCT_CLIENT_ID`/`CTCT_REFRESH_TOKEN`/`CTCT_LIST_ID`, or a non-2xx from
      either Constant Contact call, yields a generic user error + a server log, never
      leaking which var or step failed.
- [ ] `.env.example` documents the three vars (empty, server-only, commented); nothing
      secret is committed; no `compose.site.yml` change is required.
- [ ] A PII-free success event is tracked (no address in the payload); the form stays
      `ph-no-capture`. The submit event carries a `has_name` boolean (never the name).
- [ ] The box is unchanged by default; focusing the email reveals an optional "Name" field
      between the email and the button, and the field stays visible after blur - on all
      placements. On a `sm+` viewport the Subscribe button does **not** move when the Name
      field reveals (the row stays inline; email shortens); below `sm` the fields stack. An
      empty name subscribes exactly as before (identical request + payload).
- [ ] The Name field reveals with a fast (~200ms) animation - horizontal on `sm+` (button
      slides over), vertical below `sm` (button pushed down) - not an instant jump;
      reduced-motion users get an instant reveal. The collapsed Name field is not focusable
      or announced before it is revealed.
- [ ] A name splits on the first whitespace: `"Matthew Maynes"` sets `first_name` "Matthew"
      + `last_name` "Maynes"; a single token sets only `first_name`; three-plus tokens put
      the remainder in `last_name`. `splitName` and the payload builder are unit-tested
      (incl. extra spaces, empty, over-length); verified end-to-end against the real list
      once before merge.
- [ ] After a successful subscribe, the fields + button are gone and a badge-shaped
      "You are on the list" confirmation (with a check, `role="status"`) sits in their place,
      roughly button-sized, on all three surfaces (listing, post, `/subscribe`). The badge
      fades + scales in (~200ms); reduced-motion users see it appear with no animation. The
      error path is unchanged (inline message below the row).
- [ ] `/subscribe` returns 200 with its own `<title>`, the invitation copy, the three-field
      form (name visible from first paint), a "Latest post" card (cover, title, excerpt,
      date, and the post's **tags**) linking to the newest post, and a "See all posts" link
      to `/blog`. `/subscribe` is present in `sitemap.xml`; the top nav is unchanged (no
      Subscribe link).
- [ ] Smoke guards: `/subscribe` HTML carries `sm:flex-row sm:items-end` **and** the revealed
      Name marker (`sm:max-w-md`); `/blog` carries `sm:flex-row sm:items-end` but the
      collapsed marker (`sm:max-w-0`, name hidden by default); the success-badge copy and the
      `subscribe-badge-in` keyframe ship in the built client chunk / CSS (the state is
      client-only, so it guards that the success UI + animation are wired).
- [ ] Unit tests cover validation, payload shaping, token refresh, and submit success/
      failure with `fetch` mocked; smoke tests assert the subscribe block on all three
      surfaces on subscribe-unique copy.
- [ ] Tests green; lint + build clean; the reveal, success badge, and `/subscribe` page
      verified in a real browser (desktop + mobile, motion + reduced-motion).
