"use client";

import {
  Clock,
  Facebook,
  Github,
  Instagram,
  Linkedin,
  X,
  type IconBaseProps,
} from "@rogueoak/icons";

/**
 * Brand glyphs for the social profiles, shared by the footer and the resume
 * sidebar. Thin wrappers over the curated `@rogueoak/icons` set so the site
 * uses the design system's marks, not hand-kept SVG paths. Each takes the usual
 * icon props (size via `className`, e.g. `h-5 w-5`) and paints with
 * `currentColor`, so the caller controls colour and size. `aria-hidden` by
 * default - the surrounding link carries the label.
 *
 * This is a `"use client"` boundary: the `@rogueoak/icons` barrel re-exports an
 * `IconProvider` (React context evaluated at module scope), so importing it into
 * a Server Component (footer, resume page) would fail the RSC build - the same
 * boundary `src/components/ui.ts` puts around Canopy (see overview/learnings).
 */
export function LinkedInIcon(props: IconBaseProps) {
  return <Linkedin aria-hidden {...props} />;
}

export function GitHubIcon(props: IconBaseProps) {
  return <Github aria-hidden {...props} />;
}

export function XIcon(props: IconBaseProps) {
  return <X aria-hidden {...props} />;
}

export function FacebookIcon(props: IconBaseProps) {
  return <Facebook aria-hidden {...props} />;
}

export function InstagramIcon(props: IconBaseProps) {
  return <Instagram aria-hidden {...props} />;
}

/**
 * A clock glyph for the post reading-time pill. Same client-boundary wrapper as
 * the brand glyphs so a Server Component (the blog post page) can render it
 * without importing `@rogueoak/icons` directly. `aria-hidden` by default - the
 * adjacent "N min read" text carries the meaning.
 */
export function ClockIcon(props: IconBaseProps) {
  return <Clock aria-hidden {...props} />;
}
