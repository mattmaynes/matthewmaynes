# 0036 - Login gate for the not-yet-public preview area

## Problem

The not-yet-public area at `/blog/drafts` (drafts from spec 0034, plus scheduled-post previews from
spec 0035) is reachable by anyone who knows or guesses a URL - it is only `noindex`, not private.
0034 explicitly deferred access control ("reachable-by-URL is fine"); that call is now reversed. A
draft or a scheduled post can contain not-ready copy, an embargoed announcement, or a cover under NDA,
and it should not be one lucky URL away from a stranger. There is no auth anywhere in the app today
(no `middleware.ts`, no session), so this introduces the first gate - deliberately the smallest one
that works, not a user system.

## Outcome

- **A styled login screen.** `GET /login` renders an on-brand page (Harbor theme, same layout as the
  rest of the site) with a single password field and an "Unlock" button. No usernames, no accounts -
  one shared password.
- **The preview PAGES are gated.** Any request to the `/blog/drafts` index or a `/blog/drafts/<slug>`
  preview **page** without a valid session is redirected to `/login?next=<original-path>`. On correct
  password the user is redirected back to `next` and can browse every preview until the session
  expires.
- **The preview OG-image routes stay public.** `/blog/drafts/<slug>/opengraph-image` is deliberately
  NOT gated, so link-preview unfurling (Slack, iMessage) still renders a preview's share card. The
  accepted, bounded cost: the card (title, excerpt, cover) is fetchable by URL, but the readable post
  behind it is not. (The published post's OG card at `/blog/<slug>/opengraph-image` remains gated by
  `isPublishedNow` from spec 0035, so a scheduled post's card is only reachable via this preview route.)
- **Published content is never affected.** `/blog`, `/blog/<published-slug>`, the feed, sitemap, home,
  and every non-preview route stay completely open and unchanged. The gate is scoped to the
  `/blog/drafts` prefix only (minus the OG sub-route).
- **A durable session.** A correct password sets a signed, `httpOnly`, `Secure`, `SameSite=Lax`
  cookie that keeps the user in for ~30 days; a wrong password re-renders `/login` with a generic
  error and no session. The cookie is unforgeable without the password (HMAC), so no server-side
  session store is needed.
- **Safe by construction.** The password lives only in server env (never in the bundle or repo);
  attempts are rate-limited per IP; the compare is timing-safe; the password is never logged.
- **Fail-closed.** If `PREVIEW_PASSWORD` is unset, the gate denies (no password can match), so a
  misconfigured deploy locks previews down rather than leaking them. Documented, with the host env
  step called out so the author is not surprised.
- **Optional logout.** `GET /logout` clears the cookie and returns to `/blog`.

## Scope

**In**

- `src/proxy.ts` (the Next "proxy" convention - successor to `middleware.ts` in Next 16; Edge runtime)
  exporting a `proxy` function with
  `export const config = { matcher: ["/blog/drafts", "/blog/drafts/:path*"] }`. The function first
  **bypasses** (`NextResponse.next()`) any path ending in `/opengraph-image` (keep OG cards public -
  a matcher exclusion regex is brittle, so gate it in code), then reads the session cookie, verifies
  the HMAC token with Web Crypto (`crypto.subtle`, Edge-compatible), and on failure
  `NextResponse.redirect` to `/login?next=<pathname>`. Valid token -> `NextResponse.next()`.
- `src/app/login/page.tsx`: an on-brand Server Component form (`method="POST"` to the verify route),
  a password `<input type="password">`, the "Unlock" button, an error slot driven by a `?error=1`
  query param, and a hidden `next` field carried from the query. `robots: noindex`.
- The verify handler (prefer `/v1/login` to match the existing `/v1/*` convention - decide in build):
  `POST` that
  - applies the shared per-IP rate limit + same-origin guard from `src/lib/http-guards.js` (reuse,
    do not reinvent);
  - timing-safe compares the submitted password against `process.env.PREVIEW_PASSWORD` (unset -> always
    fail, fail-closed);
  - on match, sets the signed cookie and 303-redirects to a safe, same-origin `next` (reject absolute
    / protocol-relative `next` - default `/blog/drafts`);
  - on miss, redirects back to `/login?error=1&next=...` (generic error).
- A pure, unit-tested auth core `src/lib/preview-auth.js` (fs-free, like `contact.js`/`subscribe.js`):
  `signSession(secret)` -> token, `verifySession(token, secret)` -> boolean (HMAC-SHA256, constant-time
  compare, written against Web Crypto so the Edge middleware and the Node handler share ONE impl), and
  `safeNext(raw)` -> a same-origin path or the default. The token derives from `PREVIEW_PASSWORD`
  (single env var) so there is no second secret; rotating the password invalidates sessions (documented).
- Env: `PREVIEW_PASSWORD` (server-only, runtime), added to the architecture doc's env list and the
  host `.env.site`. No `NEXT_PUBLIC_` exposure. Force-empty in CI so the guard/error paths run
  without a real secret (learnings 0007/0008).
- `/logout` handler that clears the cookie.
- Tests: unit over `preview-auth.js` (sign/verify round-trip, tampered token fails, wrong/empty
  password fails, `safeNext` rejects `//evil.com` and `https://evil.com` and keeps `/blog/drafts/x`);
  smoke (must be able to fail): the `/blog/drafts` index and a `/blog/drafts/<slug>` page without a
  cookie 302 to `/login`; with a valid cookie 200; **`/blog/drafts/<slug>/opengraph-image` returns
  200 (image) with NO cookie** (public); a published post URL is never redirected; `/login` renders
  the form and is `noindex`.

**Out**

- Multiple users, roles, real accounts, OAuth, email links - one shared password is the whole model.
- Gating anything other than the `/blog/drafts` prefix, or gating the preview OG-image sub-route.
  Published content stays open.
- Password reset UX, "remember me" toggle, account lockout beyond the existing per-IP rate limit.
- Encrypting the preview HTML at rest or hiding preview slugs - the gate is the control.

## Approach

- **Stateless HMAC session.** The cookie carries `base64url(HMAC_SHA256(key=PREVIEW_PASSWORD,
  msg="preview-authed:v1"))`. Middleware recomputes the expected token and constant-time compares -
  no DB, no session table, works across the blue/green rollout with no shared state. Rotating the
  password rotates the key, so all sessions drop (acceptable, documented). The `:v1` tag lets the
  scheme evolve.
- **Edge-safe crypto.** Middleware runs on the Edge runtime, so verification uses Web Crypto
  (`crypto.subtle.importKey` + `sign`) - available in middleware, unlike `node:crypto`. The `POST`
  verify handler can run on the Node runtime and share the same pure `preview-auth.js` core (written
  against Web Crypto so both runtimes use one implementation).
- **OG routes stay public - by code, not matcher.** The middleware matches the whole `/blog/drafts`
  prefix (so the index and every preview page are covered), then early-returns `next()` for any
  `.../opengraph-image` path. This keeps link-preview testing working (spec 0034's intent) while the
  readable HTML is gated. Doing the exclusion in code avoids a brittle negative-lookahead matcher.
- **Composition with 0035.** Because spec 0035 keeps ALL previews (drafts + scheduled) under the one
  `/blog/drafts` prefix, a single middleware matcher gates both with no per-kind logic. This is why
  0035 reused that path instead of a second `/blog/scheduled` tree.
- **Open-redirect + same-origin.** `safeNext` only returns a path that starts with a single `/` and
  not `//`, else the default `/blog/drafts`; the verify handler also applies the same-origin guard
  from `http-guards.js`. Together they stop `?next=` and cross-site POST abuse.
- **No secret leakage.** `PREVIEW_PASSWORD` is read only in server code (middleware + route), never in
  a client component or a `NEXT_PUBLIC_` var, so it cannot reach the bundle - guarded structurally
  like the existing contact/subscribe secrets, and asserted by a test that greps the built client for
  the value being absent.
- **Rollout order (operational).** The host must gain `PREVIEW_PASSWORD` in `.env.site` before or
  with this deploy; because the gate is fail-closed, previews are locked (not leaked) in the gap. Set
  the env, deploy, then confirm login works - so the author is never locked out unexpectedly.

## Acceptance

- [ ] The `/blog/drafts` index and a `/blog/drafts/<slug>` page without a valid cookie redirect
      (302/307) to `/login?next=<path>`; with a valid cookie they return 200 and render as before.
- [ ] `GET /blog/drafts/<slug>/opengraph-image` returns 200 with an image content type and **no
      cookie** (the OG route stays public); the published `/blog/<slug>/opengraph-image` still 404s a
      not-yet-due scheduled post (spec 0035, unchanged).
- [ ] `GET /login` renders the on-brand password form and is `noindex`; a correct password sets the
      cookie and lands back on `next`; a wrong password re-renders with a generic error and no cookie.
- [ ] No published route is ever redirected: `/blog`, a published `/blog/<slug>`, `/blog/feed.xml`,
      `/sitemap.xml`, and home are unaffected.
- [ ] With `PREVIEW_PASSWORD` unset the gate fails closed (previews inaccessible, not leaked).
- [ ] Login attempts are per-IP rate-limited (reusing `http-guards.js`); the compare is timing-safe;
      `PREVIEW_PASSWORD` never appears in the client bundle (grep test) and is never logged.
- [ ] `safeNext` rejects `//evil.com` and `https://evil.com` and preserves an in-app path; the verify
      handler enforces same-origin.
- [ ] `preview-auth.js` has unit tests (sign/verify round-trip, tampered token, wrong/empty password,
      `safeNext`); smoke covers the redirect, the authed 200, the public OG route, the published-route
      pass-through, and `/login` noindex.
- [ ] `npm run lint`, `npm test`, `npm run build` green.
