# Plan 0018 - Blog email subscribe (Constant Contact)

Source spec: `docs/specs/0018-blog-subscribe.md`. Build order, files touched, and
verification. Approved decisions folded in: subscribe block sits **after** the post
disclaimer; the shared HTTP guards are **extracted** into a neutral module both
features import.

## Step 1 - Extract shared HTTP guards (refactor, no behavior change)

- **New** `src/lib/http-guards.js`: move `createRateLimiter`, `isHoneypotFilled`,
  `isSameOrigin` verbatim out of `src/lib/contact.js` (with their JSDoc). These are
  generic, request-agnostic guards - no contact- or subscribe-specific assumptions.
- **Edit** `src/lib/contact.js`: delete those three definitions; re-export them from
  `./http-guards.js` so existing importers (`@/lib/contact`) and
  `tests/contact.test.mjs` keep working unchanged (`export { createRateLimiter,
  isHoneypotFilled, isSameOrigin } from "./http-guards.js"`).
- Verify: `node --test tests/contact.test.mjs` stays green (pure refactor).

Files: `src/lib/http-guards.js` (new), `src/lib/contact.js` (edit).

## Step 2 - Subscribe core (pure, unit-tested)

- **New** `src/lib/subscribe.js` (plain JS + JSDoc, I/O-free except injectable fetch):
  - `SUBSCRIBE_LIMITS = { email: 200 }`; reuse the same loose `EMAIL_RE`.
  - `validateSubscribe(input)` -> `{ ok, data:{ email } }` | `{ ok:false, error }`:
    trim, require email, shape + length cap.
  - `buildSignUpPayload(email, listId)` -> `{ email_address, create_source: "Contact",
    list_memberships: [listId] }` (Constant Contact `sign_up_form` body). `create_source`
    is `"Contact"` = visitor self-signup.
  - `refreshAccessToken({ clientId, refreshToken }, fetchImpl=fetch)`: `POST`
    `https://authz.constantcontact.com/oauth2/default/v1/token`, form-encoded
    `grant_type=refresh_token` + `refresh_token` + `client_id` (public client, no
    secret). Returns `{ accessToken, expiresInSec }`; throws on non-2xx (bounded by
    `AbortSignal.timeout`).
  - `addContactToList({ accessToken, email, listId }, fetchImpl=fetch)`: `POST`
    `https://api.cc.email/v3/contacts/sign_up_form` with `Authorization: Bearer`,
    JSON `buildSignUpPayload(...)`. Throws on non-2xx (bounded). 200/201 => ok.
  - `createTokenCache(now=Date.now)`: module-scoped access-token cache with expiry
    (skew ~60s). `getAccessToken(creds, fetchImpl)` mints on miss/expiry, reuses
    otherwise. Safe because the refresh token is **non-rotating** (nothing to persist).
  - `submitSubscription({ email, clientId, refreshToken, listId }, { fetchImpl, cache })`:
    orchestrates getAccessToken -> addContactToList. The seam the route calls.

Files: `src/lib/subscribe.js` (new).

## Step 3 - Versioned route `POST /v1/subscribe`

- **New** `src/app/v1/subscribe/route.ts`, modeled on `src/app/v1/contact/route.ts`:
  - Import guards from `@/lib/http-guards`; `validateSubscribe` + `submitSubscription`
    from `@/lib/subscribe`.
  - Module-scoped `createRateLimiter({ max: 5, windowMs: 10*60*1000 })`,
    `MAX_BODY_BYTES = 8*1024` (email-only, smaller than contact), `clientIp()` reading
    the **last** `x-forwarded-for` entry (learnings feedback 0009).
  - Guard ladder identical to contact: same-origin 403 -> content-length 413 -> JSON
    parse 400 -> honeypot(`company`) silent 200 -> `validateSubscribe` 400 -> rate
    limit 429.
  - Env: `CTCT_CLIENT_ID`, `CTCT_REFRESH_TOKEN`, `CTCT_LIST_ID`. Any missing ->
    `console.error` + generic 500 (never name which).
  - `submitSubscription(...)` in try/catch -> generic 500 on throw. Success ->
    `{ ok: true }`. Module-scoped token cache instance passed in.

Files: `src/app/v1/subscribe/route.ts` (new).

## Step 4 - Subscribe form component (client island, responsive)

- **New** `src/components/subscribe-form.tsx` (`"use client"`), modeled on
  `contact-form.tsx`:
  - Title "Subscribe for updates" (semantic heading, e.g. `text-h2`/`text-h3`).
  - One email `Input` (name `email`, `type="email"`, required, `maxLength={200}`),
    Subscribe `Button` (label swaps to "Subscribing..." while submitting), hidden
    honeypot `company` field (same pattern as contact).
  - Status machine `idle | submitting | success | error{message}`; POST JSON to
    `/v1/subscribe`; branch on `res.ok && json.ok`; `text-success` / `text-danger`
    inline messages with `role="status"` / `role="alert"`.
  - **Responsive layout**: wrapping flex is `flex-col` (stacked) by default and
    `sm:flex-row sm:items-end` at the breakpoint; the input wrapper is
    `w-full sm:flex-1`, the button `w-full sm:w-auto`. So mobile = full-width input +
    full-width button stacked; `sm+` = inline row. Reuse the `RING` focus convention.
  - Analytics: PII-free events (`blog_subscribe_submitted` / `_succeeded` / `_failed`)
    via `clientAnalyticsEnabled()` gate; wrap `<form>` in `ph-no-capture`. No email
    ever in a payload.
  - Accept an optional `className` prop so the two placements can tune spacing.

Files: `src/components/subscribe-form.tsx` (new).

## Step 5 - Placement on the two surfaces

- **Edit** `src/app/blog/page.tsx`: render `<SubscribeForm />` after the
  `{listPosts.length === 0 ? ... : <BlogList/>}` block (after line 76), before
  `</section>`, wrapped so it reads as a distinct bottom-of-page block
  (e.g. `mt-16 border-t border-border pt-10`), at the container's full width.
- **Edit** `src/app/blog/[slug]/page.tsx`: render `<SubscribeForm />` **after** the
  disclaimer `<p>` (line 211) and **before** the Back/RSS nav row (line 213), inside
  the `max-w-4xl` article (approved order: content -> disclaimer -> subscribe -> nav).
- Both are Server Components rendering the client island (fine - it is `"use client"`).

Files: `src/app/blog/page.tsx` (edit), `src/app/blog/[slug]/page.tsx` (edit).

## Step 6 - Config docs + local creds

- **Edit** `.env.example`: add a commented server-only block documenting
  `CTCT_CLIENT_ID`, `CTCT_REFRESH_TOKEN`, `CTCT_LIST_ID` (empty), mirroring the
  contact block's wording (never `NEXT_PUBLIC_`; real values in git-ignored
  `.env.local` / host `.env.site`). No literal secret values.
- **Local only (not committed)**: create `.env.local` at the worktree root with the
  three real values (pulled from the host `.env.site`) so the one manual end-to-end
  signup can run. `.env*` (except `.env.example`) is git-ignored - confirm before use.
- No `compose.site.yml` change: it already reads `.env.site`, which already holds the
  three values.

Files: `.env.example` (edit). `.env.local` (local, untracked).

## Step 7 - Tests

- **New** `tests/subscribe.test.mjs` (`node --test`), mirroring `contact.test.mjs`:
  - `validateSubscribe`: valid, missing, malformed, oversized.
  - `buildSignUpPayload`: shape, `create_source: "Contact"`, list membership.
  - `refreshAccessToken`: injected fetch returns a token; asserts endpoint/grant/body;
    non-2xx throws.
  - `addContactToList`: injected fetch asserts bearer header + payload; non-2xx throws.
  - token cache: mints once, reuses within TTL, re-mints after expiry (injected `now`).
  - `submitSubscription`: happy path calls token then sign_up_form with the list id.
- **Edit** `tests/smoke.test.mjs`:
  - Add subscribe markers to the `/blog` and `/blog/[slug]` route entries -
    subscribe-unique copy that can actually fail (e.g. `"Subscribe for updates"`, the
    input placeholder, and a responsive-layout class marker like `sm:flex-row`).
  - Add `/v1/subscribe` guard tests mirroring the contact ones (403 cross-origin,
    honeypot 200, 400 invalid, 405 GET, 429 burst with a distinct `x-forwarded-for`,
    500-unconfigured-without-leak). Force `CTCT_CLIENT_ID`/`CTCT_REFRESH_TOKEN`/
    `CTCT_LIST_ID` empty in the `before` hook `env` (alongside the contact creds) so
    no real Constant Contact call is ever made.
  - Extend the client-bundle conversion-event assertion (or add one) so a chunk ships
    `blog_subscribe_submitted`.

Files: `tests/subscribe.test.mjs` (new), `tests/smoke.test.mjs` (edit).

## Step 8 - Verify (before commit)

Run in the worktree (`npm ci` already done):
1. `node --test tests/subscribe.test.mjs tests/contact.test.mjs` - unit green.
2. `npm run lint` - clean.
3. `npm run build` - clean (Turbopack pinned root; worktree has its own node_modules).
4. `npm test` - full suite incl. smoke (`--test-concurrency=1` already set) green.
5. **Manual end-to-end** (developer, with `.env.local`): submit a real email via the
   running app; confirm it lands in the "Matthew Maynes Blog" Constant Contact list.
   This is the one path unit tests mock.

## Step 9 - Reflect (overview living docs)

- `overview/features.md`: add the blog subscribe capability (both surfaces + the
  `/v1/subscribe` endpoint + Constant Contact list).
- `overview/architecture.md`: fold the Constant Contact refresh-token -> access-token
  -> `sign_up_form` flow, the in-memory token cache, and the reused `.env.site` secret
  wiring into "Configuration & secrets".
- `overview/learnings.md`: only if real friction surfaces (do not manufacture one).

## Step 10 - PR + persona review

- Commit, push, open PR against `main`.
- Scope personas from the diff: **engineer** (new logic), **tester** (new behavior),
  **architect** (new route + external dependency + the guard extraction),
  **security** (public endpoint, input, OAuth secrets, token handling),
  **designer** (new visible UI + responsive layout), **analytics** (new conversion
  event). Spawn each as a sub-agent posting inline file:line comments.
- Address every major/blocker (capture as feedback + roll into learnings); re-test;
  merge on developer approval. Remove the worktree after merge.

## Amendment: optional name capture (folded into spec 0018)

A follow-up increment (its own PR against `main`), added after the base subscribe
feature merged. Progressive optional name capture, split into Constant Contact
first/last name. Files touched:

- `src/lib/subscribe.js` - new pure `splitName(name)` (split on first whitespace,
  cap each part at the 50-char CTCT field limit, omit empties); `validateSubscribe`
  now normalizes an optional `name`; `buildSignUpPayload` adds `first_name`/
  `last_name` only when present (nameless payload byte-identical to before);
  `submitSubscription`/`addContactToList` thread the split name.
- `src/app/v1/subscribe/route.ts` - reads `name` from the body, passes it through.
- `src/components/subscribe-form.tsx` - `expanded` state set on email focus reveals
  an optional "Name" field (in SSR DOM, `display:none` until revealed) between email
  and button; layout reflows to stacked when expanded; posts `name`; adds a PII-free
  `has_name` boolean to the submit event.
- `tests/subscribe.test.mjs` - `splitName` edge cases, optional-name validation,
  payload with/without name parts, split name reaching the sign_up_form body.
- `tests/smoke.test.mjs` - "Name (optional)" marker on both blog surfaces.
- `docs/overview/features.md`, `docs/overview/architecture.md` - documented.

Verify: unit + smoke green; lint + build clean; one real end-to-end signup with a
name confirms first/last land on the contact.
