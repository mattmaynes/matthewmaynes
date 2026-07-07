# 0024 - Subscribe surface polish: animate the name reveal + tags on the latest-post card

## Problem

Two small rough edges on the subscribe surfaces (spec 0020):

1. The optional Name field **pops in instantly** on email focus - the Subscribe button
   jumps (desktop) / the form lurches (mobile). It is functional but jarring.
2. The `/subscribe` page's "Latest post" card omits the post's **tags**, which the blog
   listing rows show - so the preview is less informative than it should be.

## Outcome

1. The Name field **animates in** quickly when revealed: it grows **horizontally**
   (the field widens, the button slides over) on desktop, and **vertically** (it
   expands downward) on mobile. Fast (~200ms) and eased, so it reads as a smooth reveal
   rather than a jump. Respects `prefers-reduced-motion` (instant, no animation).
2. The `/subscribe` "Latest post" card shows the post's tags, matching the listing row.

## Scope

**In**

- `subscribe-form.tsx`: animate the Name field reveal (both axes, reduced-motion-safe),
  replacing the instant `hidden` -> visible toggle.
- `subscribe/page.tsx`: render the latest post's tags on the card.
- Smoke + doc updates (the animation changes the Name field's marker classes).

**Out**

- Any change to submit behaviour, validation, analytics, or the endpoint.
- Animating anything else on the form.

## Approach

- **Reveal animation.** `display:none` cannot transition, so the Name field stays in the
  DOM and collapses via size + opacity instead. It is always `sm:flex-1` (desktop) /
  `w-full` (mobile) with `overflow-hidden` and `transition-all duration-200 ease-out`;
  the collapsed state clamps it to zero on the axis that matters per breakpoint
  (`max-h-0` on mobile, `sm:max-w-0` on desktop, `opacity-0`), and the revealed state
  releases it (`max-h-24` / `sm:max-w-md`, `opacity-100`). `sm:max-w-md` is a cap wider
  than the field's real flex width in every container, so it never clips - it only
  bounds the animation. Because the width is `max-w`-clamped (not `display`-toggled),
  revealing it animates the button sliding over; on mobile the `max-h` grow pushes the
  button down. `motion-reduce:transition-none` gives reduced-motion users an instant
  reveal. While collapsed the input is taken out of the tab order + a11y tree
  (`aria-hidden` + `tabIndex=-1` + `pointer-events-none`), restored when revealed.
- **Latest-post tags.** The `/subscribe` card already has `latest.tags` in scope; render
  the same rounded tag chips the listing row uses, below the excerpt.

## Acceptance

- [ ] Focusing the email reveals the Name field with a fast animation - horizontal on
      `sm+` (button slides over), vertical below `sm` (button pushed down) - not an
      instant jump. Reduced-motion users get an instant reveal.
- [ ] The collapsed Name field is not focusable / announced before it is revealed.
- [ ] The `/subscribe` "Latest post" card shows the post's tags.
- [ ] Smoke: `/blog` carries the collapsed marker (`sm:max-w-0`) and `/subscribe` the
      revealed marker (`sm:max-w-md`); `/subscribe` shows a latest-post tag.
- [ ] `npm run lint`, `npm test`, `npm run build` green; verified in a real browser
      (desktop + mobile, motion + reduced-motion).
