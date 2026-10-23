# Plan 0043 - Contact form captcha (Cap)

Source: `docs/specs/0043-contact-form-captcha.md`.

## Key design decisions settled before building

**Two tokens, not one.** `capjs-core` exports only `generateChallenge` and
`validateChallenge`; there is **no exported verifier** for the token that
`validateChallenge` returns. So the flow is:

1. `POST /v1/captcha/challenge` - `generateChallenge(secret, { scope: "contact",
   instrumentation: true })` returns `{ challenge, token, expires, instrumentation }`.
2. Client solves, then `POST /v1/captcha/redeem` - `validateChallenge(...)` with
   `consumeNonce` bound to the nonce store. On success we mint **our own** compact
   HMAC token via the `signToken` hook, keyed on `CAP_SECRET`.
3. `POST /v1/contact` verifies that HMAC token with our own `verifyCaptchaToken`, and
   consumes it single-use through the same nonce store.

Do not try to re-validate the Cap token at step 3; it is not designed for that.

**Three outcomes, not two.** `validateChallenge` returns `{ success: false, reason,
instr_error? }`. The module must map results into a discriminated union:

- `{ status: "valid" }` - proceed.
- `{ status: "rejected", reason }` - the only rejecting outcome (400).
- `{ status: "errored", error }` - missing secret, thrown library call, `instr_error`.
  **Fail open** per the spec: proceed, log at error level, emit its own PostHog event.

Collapsing `errored` into `rejected` would reintroduce the invisible-failure bug that
learning 0028 exists to prevent. This distinction is the heart of the change.

**Deployment risk to verify, not assume.** `capjs-core` depends on `esbuild ^0.28.0` at
runtime (it compiles a fresh instrumentation program per challenge), and esbuild ships a
platform-specific native binary. Next.js standalone output traces dependencies, and the
repo already needs `outputFileTracingIncludes` for the email template
(`next.config.ts`). Verify the challenge route works in a standalone build before
merging. If esbuild will not trace cleanly into the container, fall back to the
`instrumentationGenerator` injection hook rather than abandoning instrumentation.

## Steps

1. **Worktree + deps.** Branch `0043-contact-form-captcha`. Add `capjs-core` pinned to
   exactly `0.1.2` (it is pre-1.0, so no caret) and `cap-widget@^0.1.57`.

2. **`src/lib/captcha.ts`** - the pure, testable core. No Next.js imports.
   - `createNonceStore({ maxKeys })` - module-scoped Map with TTL sweeping, mirroring
     `createRateLimiter` (`src/lib/http-guards.ts:46`) in shape and comment style.
     Exposes the `consumeNonce(signatureHex, ttlMs)` signature `capjs-core` expects:
     returns `true` if newly consumed, `false` if already seen.
   - `issueChallenge(secret, { scope })` - wraps `generateChallenge` with
     `instrumentation: true`.
   - `redeemChallenge(secret, body, { scope, store })` - wraps `validateChallenge`,
     mints the single-use HMAC token on success via `signToken`.
   - `verifyCaptchaToken(secret, token, { store })` - constant-time HMAC compare,
     expiry check, single-use consume. Returns the three-way union above.
   - Every outbound-capable call takes an injected dependency so tests stay network-free
     and clock-controlled, matching `tests/subscribe.test.ts:300`.

3. **`src/app/v1/captcha/challenge/route.ts`** - POST only. Same-origin guard and its own
   rate limit (challenge minting is cheap for us and costly for the client, but it is
   still an unauthenticated endpoint). Returns the challenge JSON. Missing `CAP_SECRET`
   logs at error level and returns a shape the client treats as "skip the captcha", so
   the fail-open path starts here.

4. **`src/app/v1/captcha/redeem/route.ts`** - POST only. Same guards. Returns
   `{ token }` on success, 400 on rejection.

5. **`/v1/contact` guard step.** Insert captcha verification as new step 5, between
   validation (existing 4) and the rate limit (existing 5). Renumber the existing
   comment steps 5 through 8 to 6 through 9. On `rejected` return 400 with a retryable
   message and send nothing. On `errored` continue, exactly as specified.

6. **PostHog server events** via `src/lib/posthog-server.ts`:
   - `captcha_rejected` - properties: `reason`, `form: "contact"`. **No email address.**
   - `captcha_unavailable` - the fail-open path, so a broken captcha is its own signal
     rather than blending into rejection counts.

7. **`src/components/contact-form.tsx`** - mount `cap-widget` as a visible control above
   Send, wired to `progress` and `error`. Submit is disabled until solved. Add the token
   to the existing JSON body (the form already builds it from `FormData` at line 52).
   A widget error surfaces inline and stays retryable - never a silent success.

8. **Config.** `CAP_SECRET` as an empty commented placeholder in `.env.example`, in the
   server-only block alongside `RESEND_API_KEY`. No compose change needed: the service
   already reads the git-ignored `.env.site` via `env_file`
   (`deploy/docker/compose.site.yml:36`). Document generating it as 32+ random bytes.

9. **Tests** (`node --test`, DI fetch, no globals):
   - `tests/captcha.test.ts` - valid, invalid, replayed nonce, expired token, tampered
     HMAC, and each of the three status outcomes including fail-open.
   - Extend `tests/contact.test.ts` for the new guard ordering and the 400 on rejection.
   - Extend `tests/smoke.test.ts` to assert `/contact` renders the control.

10. **Standalone build check.** `npm run build`, then exercise the challenge route
    against the standalone output to prove the esbuild dependency traced correctly.

11. **Docs (protocol step 6).** Update 0008's Out section to reference 0043; add the
    captcha to `docs/overview/features.md`; fold the two-token flow, the nonce store
    limitation, and the fail-open policy into `docs/overview/architecture.md`. No new
    learning unless the build surfaces real friction - do not manufacture one.

## Verification

- `npm test` green, `npm run lint` and `npm run build` clean.
- Manual: solve the challenge on `/contact` and confirm a real send; then `curl` the
  endpoint with no token and confirm a 400 with no mail and no Constant Contact write.
- Manual: unset `CAP_SECRET`, confirm a submission still sends and the error log plus
  `captcha_unavailable` event both fire.

## Files touched

New: `src/lib/captcha.ts`, `src/app/v1/captcha/challenge/route.ts`,
`src/app/v1/captcha/redeem/route.ts`, `tests/captcha.test.ts`.

Changed: `package.json`, `package-lock.json`, `src/app/v1/contact/route.ts`,
`src/components/contact-form.tsx`, `.env.example`, `tests/contact.test.ts`,
`tests/smoke.test.ts`, `docs/specs/0008-contact-form-email.md`,
`docs/overview/features.md`, `docs/overview/architecture.md`.
