# 0026 - Entrance animation for the subscribe success badge

## Problem

The success badge (spec 0025) appears in the same frame the fields vanish - abrupt for
what should feel like a positive moment, and inconsistent with the form, which already
animates the optional-name reveal (spec 0024). (Designer review of PR #78.)

## Outcome

On success, the badge **animates in** with a subtle fade + slight scale-up (~200ms
ease-out), matching the form's existing motion. Reduced-motion users get it instantly.

## Scope

**In**

- A mount keyframe in `src/styles/globals.css` + the class applied to the badge in
  `subscribe-form.tsx`.

**Out**

- Any change to the badge's content/size/tokens (spec 0025) or an exit animation (the
  fields simply unmount).

## Approach

- A freshly-mounted node cannot be animated with a CSS `transition` (there is no
  from-state to transition from), so the entrance is a **keyframe** animation, not a
  transition. `@keyframes subscribe-badge-in` (opacity 0 -> 1, `scale(0.96) -> scale(1)`)
  and a `.subscribe-badge-enter` class live in `globals.css` (the Tailwind entry, not
  `theme-harbor.css`, so the resume-PDF freshness hash is untouched - learnings 0011);
  a `prefers-reduced-motion: reduce` block sets `animation: none`. The badge adds the
  class. 0.2s ease-out matches the name-field reveal so the form's motion reads as one
  language.

## Acceptance

- [ ] On a successful subscribe, the badge fades + scales in (~200ms) rather than
      appearing instantly; reduced-motion users see it appear with no animation.
- [ ] Smoke: the `subscribe-badge-in` keyframe ships in the built CSS (so the animation
      can't silently become a dead class).
- [ ] `npm run lint`, `npm test`, `npm run build` green; verified in a real browser.
