# 0025 - /links subscribe form fields smooshed in the narrow column

> **Status: fix superseded (the Learning below still stands).** The `.links-subscribe` override
> described here was removed by #177, which widened the `/links` subscribe block from `max-w-md` to
> `max-w-2xl` for desktop. The container now has room for the inline row, so the override had
> nothing left to correct. Do not reinstate it: the record below is kept for the reasoning, not as a
> description of current behaviour. See `docs/specs/0039-links-page.md` for how the block lays out
> today.

## Symptom

On the `/links` link-in-bio page, the subscribe form squeezed its three fields (email + optional
name + Subscribe) into one row on desktop, smooshing the name field to an unusable width (it clipped
to "Name (opt|"). The name field should stack, not be crushed.

## Root cause

The shared Canopy `SubscribeForm` switches from a stacked column to a **row** at the `sm:` **viewport**
breakpoint (`sm:flex-row`). That assumes a full-width container. `/links` is a deliberately narrow
`max-w-md` (~448px) column, so on any desktop viewport (>= 640px) the form went to a row it did not
have room for. The form's `className` prop lands on its outer `<section>`, not the internal fields
row, so a plain class override could not flip the row back to a column.

## Fix

A **scoped CSS override** (`src/styles/globals.css`): wrap the `/links` form in a `.links-subscribe`
marker and force its fields row - the only descendant carrying `sm:flex-row` - back to
`flex-direction: column; align-items: stretch`. The selector `.links-subscribe [class*="sm:flex-row"]`
has specificity (0,2,0), which outranks Tailwind's `.sm:flex-row` (0,1,0), so it wins with no
`!important`; on mobile the form is already `flex-col`, so it is a no-op there. Now email, name, and
the button each render full width, stacked.

## Learning

**A design-system component whose layout switches on a VIEWPORT breakpoint (`sm:`) will break when
embedded in a fixed narrow column, because the breakpoint reads the window, not the container.** When
you place such a component in a `max-w-*` column narrower than its row-layout breakpoint, override to
the stacked layout with a container-scoped rule rather than trusting the viewport breakpoint. Target
the internal layout class by attribute selector (`[class*="sm:flex-row"]`) at higher specificity so
no `!important` is needed, and scope it to a wrapper so only that embedding is affected. (Generalizes
past this fix, so it feeds `overview/learnings.md`.)
