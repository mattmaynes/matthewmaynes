# 0022 - Breadcrumbs on a blog post

## Problem

A reader on a `/blog/[slug]` post has no persistent, top-of-page way back to the blog
listing - only a "Back to blog" link buried at the very bottom (and the previous/next
tiles, spec 0021). Getting back up to the list should be obvious and immediate.

## Outcome

Each post shows a breadcrumb trail at the top: **Blog / {post title}**, where "Blog"
is a link (to `/blog`) and the post title is the current (non-interactive) location.
It renders as a proper `<nav aria-label="breadcrumb">` landmark with an ordered list,
so it is accessible and unobtrusive. The trail starts at the listing (not `Home`) -
that is the only ancestor a reader on a post needs to step back to.

## Scope

**In**

- Bump `@rogueoak/canopy` to `^0.6.0` (the version that ships the `Breadcrumb` Twig
  set) and re-export the breadcrumb components through the existing
  `src/components/ui.ts` client boundary.
- Render the trail at the top of `src/app/blog/[slug]/page.tsx`.
- Smoke + doc updates.

**Out**

- Breadcrumbs on any other route (the blog listing, resume, etc.) - the ask is the
  post page. A site-wide breadcrumb convention can follow if wanted.
- Removing the bottom "Back to blog" link - it stays; the breadcrumb complements it.
- Any auto-collapsing / `BreadcrumbEllipsis` behaviour - the trail is only three deep.

## Approach

- **Canopy 0.6.0 `Breadcrumb` Twig set** (shadcn-shaped): `Breadcrumb` (the `<nav>`
  landmark) > `BreadcrumbList` (`<ol>`) > `BreadcrumbItem` (`<li>`) wrapping either a
  `BreadcrumbLink` (interactive ancestor) or `BreadcrumbPage` (current, `aria-current`),
  with decorative `BreadcrumbSeparator`s between. `BreadcrumbLink` takes `asChild`
  (Radix `Slot`) so it wraps a Next `<Link>` and Canopy stays router-agnostic.
- **Client boundary.** Canopy Twigs evaluate React context at module scope, so - like
  every other Canopy import - the breadcrumb components are re-exported through the
  `"use client"` `src/components/ui.ts` barrel and imported from there, never from
  `@rogueoak/canopy/*` directly (learnings 0001). The Server-Component post page can
  then render them.
- **Trail.** `Blog` (`/blog`) / `{post.title}` (current page). Placed as the first
  element inside the `<article>`, above the cover/header, with bottom margin.
- **Tailwind scan.** `globals.css` already `@source`s the whole `@rogueoak/canopy`
  package, and the breadcrumb components ship full literal Tailwind class strings, so
  their utilities are emitted with no config change (learnings 0001).

## Acceptance

- [ ] Every post renders a `nav[aria-label="breadcrumb"]` with Blog -> `/blog` and the
      post title as the current (non-link) crumb, above the cover.
- [ ] `@rogueoak/canopy` is `^0.6.0` in `package.json` + lockfile; the rest of the site
      (TopNav header, forms, cards) still renders correctly after the bump.
- [ ] Smoke: a post's HTML carries `aria-label="breadcrumb"`, a `href="/blog"` breadcrumb
      link, and the post title in the trail.
- [ ] `npm run lint`, `npm test`, and `npm run build` are green; the post page verified
      in a real browser.
