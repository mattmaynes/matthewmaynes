# 0008 - Contact form sends email server-side

## Problem

`/contact` (`src/app/contact/page.tsx`) ships a **deliberately inert** form: every
`FormField` is `disabled`, the submit is a `type="button"` labeled "Send (coming
soon)", and the note says it "does not send anything yet." A visitor who wants to
reach Matthew must fall back to the LinkedIn/GitHub links. The feature was
scaffolded (features.md marks `/contact` 🚧 "a contact form that sends email
server-side") but never wired to a backend.

The hard constraint is privacy: **this repo is public** (see `CLAUDE.md`), so the
destination inbox (a private Gmail address, held only in `CONTACT_TO_EMAIL`) must
never appear in tracked files, git history, or anything shipped to the browser. The runtime was chosen with this
in mind - architecture.md: "Node server over static export ... to support the
server-side contact form," and the secrets section already reserves "a mail
provider credential and the destination address ... provided at runtime via the
environment, never committed."

Because the form is on a public page, it is a spam magnet the moment it goes live.
features.md tracked spam protection as "a follow-up, not part of the v1 scaffold" -
but there is no separable v1 here: turning the form on without any abuse guard
ships an open mail relay to Matthew's inbox. So basic spam protection is in scope
for this spec (it is what makes shipping safe), while a CAPTCHA is the follow-up.

## Outcome

A visitor fills Name / Email / Message on `/contact`, clicks Send, and sees inline
confirmation that the message was sent (or a clear error). Matthew receives an
email at his private address with the message, `Reply-To` set to the visitor's
address so a reply reaches them. The destination address is never present in the
client bundle, page HTML, repo, or history. Obvious bot spam (honeypot-filled, or
a burst from one client) is dropped before it sends.

## Scope

In:
- Make the `/contact` form live: enabled inputs, a working submit, submitting /
  success / error states.
- Redesign the `/contact` page: drop the `PagePlaceholder` chrome/note entirely.
  The **form comes first, full content width** (page container's standard gutters,
  responsive sizing), then a **single row of social icons** beneath it -
  **icon-only, no channel names** - LinkedIn, X, Facebook, Instagram. Add the
  Facebook (`facebook.com/mew.maynes`) and Instagram (`instagram.com/matthew.maynes`)
  URLs to `src/lib/site.ts` `social` and Facebook/Instagram glyph wrappers to
  `src/components/social-icons.tsx` (both marks exist in `@rogueoak/icons`).
- A **versioned API route** - `POST /v1/contact` (`src/app/v1/contact/route.ts`) -
  that validates input, applies spam guards, and relays the message via the
  already-configured **Resend** account (domain `matthewmaynes.com` verified, API
  key in hand). The form posts to it with `fetch`.
- A pure, unit-tested validation/sanitization/spam module (`src/lib/contact.ts`)
  as a testable seam - the route handler is a thin wrapper over it plus the send.
- Spam guards sufficient to ship safely: a **honeypot** field, **server-side
  validation** (required fields, email shape, length caps), a **best-effort
  per-IP rate limit**, and a **same-origin check** (the endpoint is public, so
  reject cross-origin POSTs that a scraper would send directly).
- Secret wiring: documented placeholders in `.env.example`; a git-ignored
  `env_file` read by `deploy/docker/compose.site.yml` on the server. No secret
  enters git.
- Tests: unit tests for `src/lib/contact.ts` (validation, honeypot, rate limit,
  payload shaping) with the network send mocked; a smoke assertion that `/contact`
  now renders the real, enabled form and the "coming soon" placeholder is gone.

Out:
- CAPTCHA / Cloudflare Turnstile - the honeypot + rate limit cover launch; add a
  challenge later only if bots get through. (Follow-up.)
- A durable/shared rate-limit store (Redis, etc.). One container, low traffic - an
  in-process limiter is enough; its reset-on-restart limitation is documented, not
  solved here.
- Storing submissions (DB, log of message bodies). Email relay only; no PII at rest.
- An **unversioned** or differently-prefixed endpoint - the interface is exactly
  `POST /v1/contact` (decided below); `/v1/` leaves room to evolve the contract
  without breaking a published one.
- Auto-reply to the sender, attachments, rich formatting.

## Approach

**Interface - a versioned API route, `POST /v1/contact`.** A Route Handler at
`src/app/v1/contact/route.ts` exports `POST` (and only POST - other methods 405).
It reads the JSON body, runs `src/lib/contact.ts`, and returns JSON: `{ ok: true }`
on success, or an error shape with the right status (400 validation, 429 rate
limit, 403 cross-origin, 500 config/send failure); a honeypot hit returns 200 `ok`
silently. Route handlers run server-side, so secrets are read there and never reach
the client. The `/v1/` prefix versions the contract so it can evolve without
breaking a published one. Per the Canopy client-boundary rule (learnings 0001), the
form is a `"use client"` component (e.g. `src/components/contact-form.tsx`) that
imports the Canopy inputs through `src/components/ui.ts` and `fetch`es
`/v1/contact`, tracking submitting/success/error state; the `/contact` page stays a
Server Component and renders it.

Trade-off vs a Server Action: a public route is directly reachable by bots (a
Server Action's endpoint is obfuscated and same-origin by construction), and the
no-JS progressive-enhancement path is lost. Both are acceptable here - the spam
guards below (honeypot + rate limit + **same-origin check**) cover the exposure,
and a contact form degrading without JS is a non-issue for this audience. The win
is an explicit, versioned, `curl`-testable contract.

**Send - Resend via `fetch`, no new dependency.** The action POSTs to Resend's REST
API (`https://api.resend.com/emails`) with the built-in `fetch` - matching the
repo's "no new dependency" habit (icons, ICO packer, OG fonts). `from` is a
verified-domain address (e.g. `Contact Form <contact@matthewmaynes.com>`), `to` is
the private destination, `reply_to` is the visitor's email, subject/body carry the
name + message. (Trade-off: the `resend` SDK gives typed helpers, but a single
POST does not justify a dependency + its transitive tree; if we later add more mail
flows, revisit.)

**Page layout.** `/contact` stops using `PagePlaceholder` and renders its own
heading + the form as the primary, full-width element (constrained only by the
shared page container gutters, fluid below that), with the social row beneath. The
row reuses the `social-icons.tsx` wrappers (extended with `FacebookIcon` /
`InstagramIcon` over the `@rogueoak/icons` `Facebook` / `Instagram` marks, same
`"use client"` boundary and `aria-hidden` pattern as the existing three). Each icon
is a link to its profile (`target="_blank"`, `rel="noopener noreferrer"`) with an
accessible name via `aria-label`/visually-hidden text, since there is no visible
label. URLs come from `site.social` - the single source of truth - so `github`
stays defined for the footer even though the contact row now omits it.

**Config - three server-only env vars, none `NEXT_PUBLIC_`:**
- `RESEND_API_KEY` - secret; the Resend key.
- `CONTACT_TO_EMAIL` - the private destination inbox (a Gmail address). Kept in env,
  never in the repo, even though it is "just" an address - that is the whole privacy
  requirement (and precisely why the literal value is not written here).
- `CONTACT_FROM_EMAIL` - the verified-domain sender (public info, but env-driven so
  code carries no address). Optional; defaults to a `contact@` on the site domain.

The action fails closed: if `RESEND_API_KEY`/`CONTACT_TO_EMAIL` are unset it returns
a generic error and logs server-side, never echoing config to the client.

**Spam guards (in `src/lib/contact.ts`, pure + tested):**
- *Honeypot*: a visually hidden, `autoComplete="off"`, `tabIndex={-1}` field (e.g.
  "company"). If non-empty, the action returns a **success** result without sending
  (silent drop - do not tell the bot it failed).
- *Validation*: name and message required after trim; email must match a basic
  shape; length caps (name <= 100, email <= 200, message <= 5000) to bound payloads.
- *Rate limit*: an in-process map keyed by client IP (from `x-forwarded-for`, set by
  Caddy) - N sends per rolling window; over the limit returns 429. Best-effort and
  single-container by design; the limitation is documented in code + architecture.md.
- *Same-origin*: reject a POST whose `Origin` (fall back to `Referer`) is not the
  site origin with 403 - cheap defense now that the endpoint is publicly reachable.
  A determined bot can forge `Origin`, so this thins drive-by spam rather than being
  a security boundary; the honeypot + rate limit remain the real guards.

**Secret wiring (host, not repo):**
- `.env.example` gains the three vars as empty, commented placeholders (it already
  states "No secrets belong in this file").
- `deploy/docker/compose.site.yml` adds `env_file: [.env.site]` to the `site`
  service. The operator creates `deploy/docker/.env.site` **once** on the host with
  the three values, `chmod 600`. It matches the repo's `.gitignore` `.env*` rule so
  it can never be committed, and because the deploy is `git reset --hard` with no
  `git clean`, the untracked file survives every subsequent deploy. `env_file`
  paths resolve relative to the compose file, and inject the vars into that
  container only - not the host shell (so it does not depend on the non-interactive
  SSH deploy sourcing a profile, which it would not). CI/CD needs no new GitHub
  secret: the image is config-free and reads env at runtime.
- Local dev: the same three vars go in a git-ignored `.env.local` at the repo root,
  which Next.js auto-loads for `npm run dev`.

**Docs (step 6):** flip `/contact` to ✅ in features.md, fold the honeypot/rate-limit
design into architecture.md's "Configuration & secrets", and capture any friction as
a learning.

## Acceptance

- [ ] `/contact` renders an enabled form (Name, Email, Message, a working Send)
      that `fetch`es `POST /v1/contact`; the "Send (coming soon)" button and "does
      not send anything yet" note are gone, and `PagePlaceholder` is no longer used.
- [ ] The form is the first, full-width element; beneath it a single row of
      icon-only social links (LinkedIn, X, Facebook, Instagram) - no channel names -
      each an accessible external link whose URL comes from `site.social`. Layout
      stays responsive with the standard page gutters.
- [ ] `POST /v1/contact` with a valid body calls Resend with `to` = `CONTACT_TO_EMAIL`,
      `reply_to` = the visitor's email, and the name/message in the body, and returns
      `{ ok: true }`; the UI shows a success state. Other HTTP methods return 405.
      (Verified with the Resend call mocked in tests; one real end-to-end send
      confirmed manually before merge.)
- [ ] The destination address appears in **no** tracked file, git history, client
      bundle, or rendered HTML - only in runtime env. `grep` for it in the repo and
      in the built client output finds nothing.
- [ ] A honeypot-filled submission sends no email and returns 200 `ok` (silent drop);
      missing/oversized/invalid fields return 400; a burst from one IP returns 429;
      a cross-origin POST returns 403.
- [ ] Missing `RESEND_API_KEY`/`CONTACT_TO_EMAIL` yields a generic user error and a
      server log, never leaking config to the client.
- [ ] `.env.example` documents the three vars (empty); `compose.site.yml` reads a
      git-ignored `env_file`; nothing secret is committed.
- [ ] Unit tests cover validation, honeypot, rate limit, and payload shaping; the
      smoke test asserts the real form is present and the placeholder is absent.
- [ ] Tests green; lint + build clean.
