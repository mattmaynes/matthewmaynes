# 0028 - drop the honeypot field from subscribe and contact

## Symptom

The `company` honeypot - a hidden field a real user never sees, meant to catch naive bots that fill
every input - was a **false-negative** trap for real people. Browser and password-manager autofill
routinely populate hidden fields (a `company`/organization field is a common autofill target), so a
legitimate visitor whose autofill touched the hidden input tripped the honeypot and had their
subscribe or contact submission **silently dropped** (200 `ok`, no signup, no email). The visitor
saw success and never learned their message went nowhere.

## Root cause

The honeypot assumes only bots fill hidden fields. In practice autofill agents fill them too, so the
guard rejects real submissions it was never meant to catch. Upstream `@rogueoak/canopy` reached the
same conclusion and removed the `company` honeypot from `SubscribeForm` in `1.4.0` (`SubscribeValues`
is now `{ email, name }`), mirroring canopy feedback 0024. This repo carried the same pattern in its
hand-rolled contact form and both server routes, so it inherited the same false-negative.

## Fix

Remove the honeypot everywhere:

- Bump `@rogueoak/canopy` to `^1.4.0`; the subscribe wrapper (`src/components/subscribe-form.tsx`)
  no longer reads or POSTs `company`.
- Drop the hidden `company` input and its FormData read from the hand-rolled contact form
  (`src/components/contact-form.tsx`).
- Remove the honeypot drop and the `input.company` read from both routes
  (`src/app/v1/{subscribe,contact}/route.ts`), renumbering the guard steps.
- Remove the now-unused `isHoneypotFilled` from `src/lib/http-guards.ts` and its unit + smoke tests.

The same-origin check and the per-IP rate limiter remain the real spam guards; the honeypot was only
ever a "thin the drive-by traffic" measure, and it cost real submissions to keep.

## Learning

**A honeypot hidden field is not a free spam guard - autofill agents fill hidden fields, so it
silently drops real users (a false negative that is invisible to both sides).** Prefer guards that
cannot misfire on a legitimate submission - same-origin checks and rate limiting - over a hidden-field
trap. When a shared design-system component (here canopy `SubscribeForm`) removes such a trap, mirror
the removal in any hand-rolled forms that copied the pattern. (Generalizes past this fix, so it feeds
`overview/learnings.md`.)
