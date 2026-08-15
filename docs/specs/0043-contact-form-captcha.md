# 0043 - Contact form captcha (Cap)

## Problem

Spam signups are reaching Constant Contact through `/contact`. Two observed addresses -
both Gmail dot-alias variants that normalize to a single inbox - arrived as well-formed
submissions with the subscribe opt-in ticked, so `/v1/contact` relayed the message *and*
pushed the address to the blog and website lists
(`src/app/v1/contact/route.ts:162-202`).

The guards that were supposed to cover this are gone or were never sufficient:

- The **honeypot** shipped by 0008 was removed on 2026-08-09 (`5519fcd`, feedback 0028):
  autofill populates hidden fields, so it silently dropped real people. That removal was
  correct and is not being reversed.
- The **same-origin check** is explicitly not a security boundary
  (`src/lib/http-guards.ts:15`) - `Origin` is trivially forged by a scripted client.
- The **per-IP rate limit** is in-process, 5 per 10 minutes
  (`src/lib/http-guards.ts:46`), and is defeated by rotating source addresses.

None of the three stops a script POSTing JSON straight at `/v1/contact`, which is the
shape of the traffic getting through. 0008 deferred a CAPTCHA as a follow-up ("add a
challenge later only if bots get through", 0008 Out); bots got through.

This spec is the first of a group. It carries the shared captcha setup - the dependency,
the pure module, the challenge endpoints, the secret - so the later subscribe-form and
Canopy specs reference it and stay small.

## Outcome

A visitor on `/contact` sees an "I'm not a robot" control above Send. Ticking it solves a
proof-of-work plus browser-instrumentation challenge in the background, showing progress
while it runs. On submit, the server verifies the resulting token before it calls Resend
or Constant Contact.

A scripted POST that carries no valid token is rejected with a 400 and sends no mail and
creates no contact. A real visitor whose challenge fails sees a clear error and can
retry - nothing a person typed is ever silently discarded.

If the captcha machinery itself is broken (missing secret, library error), submissions
continue to work and the fault is raised as its own server-side signal rather than
quietly eating every message.

## Scope

In:

- `capjs-core` as a dependency, used in **stateless** mode - no Cap Standalone container,
  no Valkey, no persistent store.
- A pure, unit-tested `src/lib/captcha.ts`: challenge generation, token verification, and
  the replay-prevention nonce store. Network-free by construction; any outbound call is
  injected as `fetchImpl`, matching the repo's test seam.
- `POST /v1/captcha/challenge` (`src/app/v1/captcha/challenge/route.ts`) issuing a
  challenge scoped to `contact`, with the instrumentation layer enabled.
- `cap-widget` mounted in `src/components/contact-form.tsx` as a **visible** control,
  wired to the widget's `progress` and `error` events.
- `/v1/contact` verifies the token as a new guard step, before the Resend send and before
  any Constant Contact call.
- **Fail-open-and-alert** policy: reject only on an explicit invalid-token verdict; on
  infrastructure error let the submission proceed and emit a distinct error-level log
  plus its own PostHog event.
- A server-side PostHog event for captcha rejections via the existing
  `src/lib/posthog-server.ts`, carrying the rejection reason and the source form. No
  email address on the event.
- `CAP_SECRET` as a server-only secret: an empty commented placeholder in `.env.example`,
  supplied on the host through the existing git-ignored `env_file` in
  `deploy/docker/compose.site.yml`.
- Tests: unit tests for `src/lib/captcha.ts` (valid token, invalid token, replayed nonce,
  expiry, infrastructure error takes the fail-open path) and for the new `/v1/contact`
  guard ordering; a smoke assertion that `/contact` renders the control.
- Update 0008's Out section so it points at this spec instead of describing the CAPTCHA
  as unstarted.

Out:

- **Subscribe form captcha.** Needs the Canopy prop, and its silent-drop behaviour plus
  raw-address PostHog event carry a privacy policy change. Its own spec, after Canopy.
- **The Canopy adapter** (`@rogueoak/canopy/captcha-cap`, plus the neutral `onVerify` and
  `verificationSlot` props). Different repo, its own spec there.
- **Generalizing the contact form into Canopy.** Later, and it depends on the slot API
  landing first.
- **Privacy policy edits.** Cap is self-hosted, adds no third party, sets no cookies, and
  no address leaves the server, so the existing "protected by basic anti-spam measures"
  line (`src/app/privacy/page.tsx:114`) already covers this change. Disclosing that a
  proof-of-work runs on the visitor's device is a reasonable optional addition, but it
  would trigger `npm run privacy:stamp`, so it is deliberately deferred to the subscribe
  spec, which needs a policy edit regardless.
- **Removing the existing guards.** Same-origin and the rate limiter stay exactly as they
  are; the captcha is an additional layer, not a replacement.
- **Cap Standalone.** The Docker plus Valkey deployment is real but disproportionate for
  two forms on a personal site, and it would add stateful infrastructure this repo
  deliberately has none of.
- **Re-adding a honeypot.** Feedback 0028 stands.

## Approach

**Stateless over standalone.** Cap's default deployment is a `tiago2/cap` container plus
Valkey with a volume. `capjs-core` provides the same two-layer challenge - SHA-256
proof-of-work plus optional JavaScript instrumentation - as a plain npm import backed by
JWTs, and is built for environments with no persistent storage. That keeps this repo's
single-container, no-database shape intact. The tradeoff it hands back is replay
prevention, via a `consumeNonce` callback.

**Nonce store: in-process, by precedent.** `consumeNonce` is backed by a module-scoped Map
with TTL sweeping, which is exactly the pattern already used by `createRateLimiter`
(`src/lib/http-guards.ts:46`) and `createTokenCache` (`src/lib/subscribe.ts:337`). It is
lost on restart and not shared across instances; the deploy is a single container, and
challenge expiry bounds the replay window, so the residual exposure is a short post-restart
window rather than an open door. This is the same limitation 0008 accepted for the rate
limiter and documented rather than solved.

**Why the instrumentation layer matters here.** Proof-of-work alone only raises an
attacker's cost. The instrumentation challenge requires executing JavaScript against a
real DOM, which is what actually distinguishes the scripted direct-to-endpoint POST that
is getting through today. It is therefore enabled, not optional.

**A visible control on contact, deliberately.** The challenge is generated server-side, so
a visible checkbox and a headless solve run the identical puzzle - the control buys no
extra protection. What it buys is honesty about latency: the proof-of-work takes real
time, and someone who has just written a long message deserves a progress indicator, a
retryable error, and something a screen reader can announce, rather than an unexplained
pause. The subscribe form, where the stakes are one input and no typed content, will take
the invisible path in its own spec.

**Fail open, and alert.** A missing `CAP_SECRET` or a library fault must not turn into a
silent total outage where every visitor sees success and no message is ever sent. So the
only rejecting outcome is an explicit invalid-token verdict. Anything else logs at error
level, emits its own PostHog event, and lets the submission through. This trades a brief
window of unprotected submissions for the guarantee that a bad deploy is loud instead of
invisible - which is the direct application of learning 0028.

**Guard ordering in `/v1/contact`.** The captcha check slots in after validation and
before the rate limit, so malformed bodies still fail fast and cheaply and a valid token
is never spent on a request that was going to 400 anyway. Existing guard numbering in the
route comments gets renumbered to match.

**Client wiring.** `cap-widget` installs from npm and bundles, so no external script tag
is introduced. Installing it is not by itself enough to keep the site's property of loading
zero third-party origins, though: at runtime the widget fetches its wasm solver from a CDN
and script-injects `pako` from another. Both have override globals, so both assets are
served from this origin (`/v1/captcha/wasm`, `/v1/captcha/pako`) and the property holds
unconditionally - which also keeps the future CSP (`next.config.ts:63`) free of a
third-party exception. The
contact form is hand-rolled over a real `<form>` and `FormData`
(`src/components/contact-form.tsx:52-61`), so the token drops into the existing submit
path with no component-library constraint.

## Acceptance

- [ ] `/contact` renders a visible "I'm not a robot" control above Send that reports
      progress while the challenge solves and surfaces a retryable error on failure.
- [ ] `POST /v1/contact` carrying a valid, unspent token behaves exactly as before:
      Resend is called, and with the opt-in ticked the Constant Contact push still runs.
- [ ] `POST /v1/contact` with no token, a malformed token, an expired token, or a token
      already spent returns 400, sends no mail, and creates no Constant Contact contact.
- [ ] With `CAP_SECRET` unset or challenge generation throwing, a valid submission still
      sends, an error-level server log names the fault, and a distinct PostHog event
      fires. The visitor sees no error.
- [ ] A captcha rejection emits a server-side PostHog event carrying the reason and source
      form, and **no** email address.
- [ ] `GET /v1/captcha/challenge` returns 405; only POST is accepted.
- [ ] `src/lib/captcha.ts` is network-free under test with `fetchImpl` injected; unit
      tests cover valid, invalid, replayed, and expired tokens plus the fail-open path.
- [ ] The existing same-origin 403, 413 size cap, 400 validation, and 429 rate-limit
      behaviours are unchanged, and the guard comments are renumbered.
- [ ] `CAP_SECRET` appears in `.env.example` as an empty placeholder and in no tracked
      file with a value; `grep` for the live value across the repo and the built client
      bundle finds nothing.
- [ ] No external script tag is added; the client bundle loads no third-party origin.
- [ ] 0008's Out section references this spec.
- [ ] Tests green; lint and build clean.
