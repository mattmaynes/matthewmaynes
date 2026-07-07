# 0025 - Subscribe success confirmation as an in-place badge

## Problem

On a successful subscribe, the form's fields + button stay on screen and a small line
of success text appears below them. The outcome is easy to miss, and leaving the now-
pointless inputs up is untidy - the reader has already subscribed.

## Outcome

When the subscribe succeeds, the email/name fields and the Subscribe button are
**replaced in place** by a compact, badge-shaped confirmation ("You are on the list"
with a check glyph) - roughly the size of the button it stands in for, so it reads at a
glance and the form no longer invites a second submit.

## Scope

**In**

- `subscribe-form.tsx`: on `status === "success"`, render the badge instead of the
  input row; drop the old below-form success line.

**Out**

- Any change to submit/validation/analytics/the endpoint or the welcome email (spec
  0076-era work) - only the success *rendering* changes.
- The error state (still an inline message below the row).

## Approach

- The input row (`<div className="flex ... sm:items-end">` holding email, the animated
  Name field, and the Button) is wrapped in a `status.kind === "success"` ternary: on
  success it is swapped for a single `role="status"` badge, so the announcement and the
  visual land together and the fields/button leave the DOM. The old standalone success
  `<p>` is removed (the badge subsumes it).
- The badge is an `inline-flex` pill (`rounded-full`, `px-4 py-2` ~ the Button's height)
  with a `Check` glyph + text, in the success tokens (`text-success` on a light
  `bg-success/10` with a `border-success/30`). `inline-flex` keeps it button-sized (it
  hugs its text) rather than stretching, so it "takes the button's place". `Check` is
  imported directly from `@rogueoak/icons` - fine here because the form is already a
  `"use client"` island (the `theme-toggle` precedent), no server boundary needed.

## Acceptance

- [ ] After a successful subscribe, the fields + button are gone and a badge-shaped
      "You are on the list" confirmation (with a check) sits in their place, roughly
      button-sized, on all three surfaces (listing, post, `/subscribe`).
- [ ] The badge carries `role="status"` (announced to assistive tech); the error path
      is unchanged.
- [ ] Smoke: the success-badge copy ships in a client chunk (the state is client-only,
      not SSR-observable), guarding that the success UI is wired.
- [ ] `npm run lint`, `npm test`, `npm run build` green; verified in a real browser
      (mocked success response) on desktop + mobile.
