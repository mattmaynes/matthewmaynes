# 0008 - Contact form sends email server-side (build plan)

Source: `docs/specs/0008-contact-form-email.md`. Built in a worktree
(`.worktrees/contact-form-email`), tested before commit, one PR.

## Steps

1. **`src/lib/site.ts`** - add `facebook: "https://www.facebook.com/mew.maynes"` and
   `instagram: "https://www.instagram.com/matthew.maynes/"` to `social`. Keep
   `github`/`x`/`linkedin` (footer still uses them).

2. **`src/components/social-icons.tsx`** - add `FacebookIcon` / `InstagramIcon`
   wrappers over `@rogueoak/icons` `Facebook` / `Instagram`, same `aria-hidden`
   pattern as the existing three.

3. **`src/lib/contact.ts`** (pure, no I/O - the testable seam):
   - `validateContact(input)` -> `{ ok, data }` | `{ ok:false, error }`: trim,
     require name+message, email shape, caps (name<=100, email<=200, message<=5000).
   - `isHoneypotFilled(v)`.
   - `isSameOrigin(origin, referer, siteOrigin)`.
   - `createRateLimiter({ max, windowMs })` -> `{ check(ip, now) }` over a `Map`
     (inject `now` for tests).
   - `buildResendPayload({ name, email, message, to, from })` -> `{ from, to,
     reply_to, subject, text }`.
   - `sendViaResend(payload, apiKey, fetchImpl=fetch)` -> throws on non-2xx (inject
     `fetchImpl` for tests).

4. **`src/app/v1/contact/route.ts`** - `export async function POST(req)`:
   same-origin (403) -> parse JSON -> honeypot (200 silent) -> validate (400) ->
   rate limit by `x-forwarded-for` (429) -> read `RESEND_API_KEY`/`CONTACT_TO_EMAIL`
   /`CONTACT_FROM_EMAIL` (missing -> 500 + `console.error`, no leak) -> send ->
   200 `{ ok:true }` (send failure -> 500). Module-level rate-limiter singleton.
   Undefined methods 405 automatically.

5. **`src/components/contact-form.tsx`** (`"use client"`) - Canopy FormField/Input/
   Textarea/Button (enabled), a visually-hidden honeypot (`company`, tabIndex -1,
   autoComplete off, aria-hidden). `onSubmit` -> `fetch("/v1/contact", POST json)`;
   idle/submitting/success/error states; reset on success; friendly copy on
   429/400/500.

6. **`src/app/contact/page.tsx`** - drop `PagePlaceholder`. Render heading +
   `<ContactForm/>` full width (page gutters, responsive), then one social row:
   icon-only links (LinkedIn, X, Facebook, Instagram) from `site.social`, each an
   external link with `aria-label` + visually-hidden text, `rel="noopener
   noreferrer"`.

7. **`.env.example`** - add commented empty `RESEND_API_KEY`, `CONTACT_TO_EMAIL`,
   `CONTACT_FROM_EMAIL`.

8. **`deploy/docker/compose.site.yml`** - add `env_file: [.env.site]` to `site`
   (the host file is created once, git-ignored, out of scope for the repo).

9. **Tests**
   - `tests/contact.test.mjs` - unit-cover validation (good/missing/oversized/bad
     email), honeypot, same-origin, rate limiter (inject clock), payload shape, and
     `sendViaResend` success + throw (inject fake fetch). No network, no real send.
   - Smoke test (`tests/*smoke*`): `/contact` now asserts the real form is present
     (an enabled control / a route-unique phrase) and the placeholder ("coming
     soon" / "does not send anything yet") is **absent** (learnings 0003/0005).

## Verify (before commit)

- `npm run lint`, `npm run build`, `npm test` (in the worktree; `npm ci` first per
  learnings 0006). Fix code/tests until green.
- Manual: one real end-to-end send with live env in `.env.local` (confirm the email
  lands, `Reply-To` is the visitor). `curl` the 405/400/403/429 paths.
- `grep` the repo + built client bundle for the destination address -> no hits.

## Review

Personas (spec §5): engineer (new logic), tester (new behavior), architect (new
route/dep-free send/env boundary), security (public endpoint, input, secrets, spam).
Inline PR comments; address every blocker/major; re-test; merge on approval.
