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
- **The drafts INDEX is gated.** A request to `/blog/drafts` (which enumerates every not-yet-public
  post) without a valid session is redirected to `/login?next=/blog/drafts`. On correct password the
  user lands back on it and can browse the previews until the session expires.
- **A preview PAGE serves its metadata publicly and gates only the body** (feedback 0022). A
  `/blog/drafts/<slug>` page returns its own OG card (title, excerpt, cover) to ANYONE, so a
  draft/scheduled link UNFURLS with the post's own preview (Slack, iMessage, etc.) - the crawler reads
  the page head, so a whole-page redirect would have shown the generic site card instead. But the
  READABLE body is gated: without a valid session the page shows a teaser (title + cover) and a "Log in
  to read" prompt, not the post text. **Accepted, owner-confirmed tradeoff:** a draft/scheduled title,
  excerpt, and cover are public in the unfurl; only the writing is protected.
- **The preview OG-image routes stay public** too, for the same unfurl reason. (The published post's OG
  card at `/blog/<slug>/opengraph-image` remains gated by `isPublishedNow` from spec 0035, so a
  scheduled post's real card is only reachable via the preview route.)
- **Published content is never affected.** `/blog`, `/blog/<published-slug>`, the feed, sitemap, home,
  and every non-preview route stay completely open and unchanged. The proxy gate is scoped to the
  exact `/blog/drafts` index; the per-post pages self-gate their body.
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
  exporting a `proxy` function with `export const config = { matcher: ["/blog/drafts"] }` - the EXACT
  index only. It reads the session cookie, verifies the HMAC token with Web Crypto (`crypto.subtle`,
  Edge-compatible), and on failure `NextResponse.redirect`s to `/login?next=/blog/drafts`; a valid
  token -> `NextResponse.next()`. The per-post preview pages are NOT matched (they self-gate their body
  at the page level, below), so their OG metadata stays public and links unfurl (feedback 0022).
- `src/app/blog/drafts/[slug]/page.tsx` is DYNAMIC and self-gates: `generateMetadata` always returns
  the post's card (public unfurl), and the page reads the session cookie (`next/headers` `cookies()` +
  `verifySession`) - authed renders the full `PostArticle`, unauthenticated renders a teaser (title +
  cover) and a "Log in to read" prompt. No `generateStaticParams`/`revalidate` here (it is per-request).
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
  host `.env.site`. No `NEXT_PUBLIC_` exposure. The fail-closed empty-secret path is covered by the
  `preview-auth` UNIT test (empty secret -> `verifySession` false); the smoke server boots with
  `PREVIEW_PASSWORD="test-secret"` to exercise the authed path, and a bundle-grep test proves that
  value never reaches the client (learnings 0007/0008).
- `/logout` handler that clears the cookie.
- Test fixtures are kept OUT of live content: the sample draft + scheduled posts live in
  `tests/fixtures/blog`, injected via a `BLOG_FIXTURES_DIR` env the loader reads ALONGSIDE
  `content/blog` (absolute or cwd-relative). The `npm test` script sets it (absolute) so every test
  build/server sees the fixtures; prod (env unset) never does, so no sample post ships on the live site.
- Tests: unit over `preview-auth.js` (sign/verify round-trip, tampered token fails, wrong/empty
  password fails, `safeNext` rejects `//evil.com` and `https://evil.com` and keeps `/blog/drafts/x`);
  smoke (must be able to fail): the `/blog/drafts` INDEX without a cookie 302s to `/login` (with a
  cookie, 200 listing the fixtures); a `/blog/drafts/<slug>` PAGE without a cookie returns **200 with
  the post's own og:title (unfurl works, not the generic site card) + a "Log in to read" prompt** and
  gates the body (with a cookie, the full post renders); **`/blog/drafts/<slug>/opengraph-image` returns
  200 (image) with NO cookie**; a published post URL is never redirected; `/login` is `noindex`.

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
- **Unfurl works because metadata is public - the gate is at the body, not the route.** An unfurler
  bot reads the PAGE's `<head>` for `og:*`; a whole-page redirect (the first cut of this spec) sent it
  to `/login` and it read the generic site card (feedback 0022). So the proxy gates only the index, and
  the per-post page serves its metadata to everyone and gates just the readable body. The preview
  OG-image route stays public for the same reason.
- **Composition with 0035.** Spec 0035 keeps ALL previews (drafts + scheduled) under the one
  `/blog/drafts` prefix, so the index gate and the per-post page-gate cover both kinds with no per-kind
  logic. This is why 0035 reused that path instead of a second `/blog/scheduled` tree.
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

- [ ] The `/blog/drafts` INDEX without a valid cookie redirects to `/login`; with a cookie it lists the
      previews. A `/blog/drafts/<slug>` PAGE without a cookie returns 200 with the post's OWN og:title
      (unfurl works) + a "Log in to read" prompt and NO post body; with a cookie the full post renders.
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
