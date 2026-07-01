# 0007 - Icons via @rogueoak/icons

## Problem

The site hand-rolls its icon SVGs: the brand marks (LinkedIn, GitHub, X) in
`src/components/social-icons.tsx` and the sun/moon glyphs inline in
`src/components/theme-toggle.tsx`. Canopy now ships `@rogueoak/icons` - a curated,
tree-shakeable React icon set (Lucide UI glyphs + Font Awesome 6 brand marks) that is the
design system's single source of truth for iconography. Maintaining our own copies means
the site can drift from the system (different glyph, stroke, or brand mark) and carries paths
we have to keep by hand.

## Outcome

- Every icon the site renders comes from `@rogueoak/icons`, not a local SVG path.
- The five icons in use map to the curated set: `Linkedin`, `Github`, `X` (FA6 brands) and
  `Sun`, `Moon` (Lucide). All five already exist in the published registry (`0.2.0`), so no
  Canopy change or release is required - the site just consumes the package.
- The footer and resume sidebar keep working unchanged: `social-icons.tsx` still exports
  `LinkedInIcon` / `GitHubIcon` / `XIcon` (now thin wrappers over the package icons), so call
  sites and their sizing (`className="h-5 w-5"`, `h-3.5 w-3.5`) are untouched.

## Scope

**In**

- Add `@rogueoak/icons` (`^0.2.0`) as a dependency.
- Rewrite `social-icons.tsx` to wrap the package's `Github` / `Linkedin` / `X`, keeping the
  existing export names and `aria-hidden` default. Make it a `"use client"` module: the
  package barrel re-exports an `IconProvider` (React context), and importing that into a
  Server Component (footer, resume page) would fail the RSC build with `createContext is not a
  function` (see overview/learnings 0001) - the client boundary sidesteps it, exactly as
  `src/components/ui.ts` does for Canopy.
- Replace the inline sun/moon SVGs in `theme-toggle.tsx` (already a client component) with the
  package's `Sun` / `Moon`.
- Regenerate `public/resume.pdf`, since the resume page's sidebar icons change (the page is not
  in the PDF freshness hash, so the check will not force it, but the rendered output changed).

**Out**

- Canopy's internal `TopNav` hamburger/close glyphs - those belong to the Canopy component, not
  the site.
- Any change to the `@rogueoak/icons` package itself (the registry already has all five icons).
- Swapping in additional icons elsewhere (none exist beyond the five).

## Approach

Keep the churn at the icon modules. `social-icons.tsx` stays the shared brand-glyph module and
the call sites (`footer.tsx`, `resume/page.tsx`) do not change. The wrappers forward all props
(so `className`-based sizing/colour still work) and default `aria-hidden` (the surrounding link
or button carries the accessible name). Verify with `lint` + `build` + the 22 tests +
`resume:pdf:check`, and eyeball the footer, `/resume`, and the theme toggle.
