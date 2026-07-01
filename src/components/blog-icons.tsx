"use client";

import { Clock, Search, type IconBaseProps } from "@rogueoak/icons";

/**
 * Decorative glyphs for the blog surfaces (post meta, listing controls). Thin
 * wrappers over the curated `@rogueoak/icons` set behind a `"use client"`
 * boundary: the icons barrel evaluates React context at module scope, so a
 * Server Component (the blog post page) can't import it directly - the same
 * boundary `social-icons.tsx` / `nav-icons.tsx` provide (see overview/learnings).
 * Kept separate from the social/brand glyphs so icon modules stay purpose-scoped.
 * `aria-hidden` because adjacent text (e.g. "N min read") carries the meaning.
 */
export function ClockIcon(props: IconBaseProps) {
  return <Clock aria-hidden {...props} />;
}

/**
 * Decorative magnifier for the listing's search input. `aria-hidden` because the
 * input's own (visually-hidden) label carries the accessible name.
 */
export function SearchIcon(props: IconBaseProps) {
  return <Search aria-hidden {...props} />;
}
