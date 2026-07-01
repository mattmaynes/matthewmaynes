"use client";

import { Download, Edit, Mail, User, type IconBaseProps } from "@rogueoak/icons";

/**
 * Decorative glyphs for the home "Around the site" cards - one per nav
 * destination. Thin wrappers over the curated `@rogueoak/icons` set behind a
 * `"use client"` boundary: the icons barrel evaluates React context at module
 * scope, so a Server Component (the home page) can't import it directly - the
 * same boundary `social-icons.tsx` provides (see overview/learnings). `aria-hidden`
 * because the card title is the accessible label.
 */
export function AboutIcon(props: IconBaseProps) {
  return <User aria-hidden {...props} />;
}

export function ResumeIcon(props: IconBaseProps) {
  return <Download aria-hidden {...props} />;
}

export function BlogIcon(props: IconBaseProps) {
  return <Edit aria-hidden {...props} />;
}

export function ContactIcon(props: IconBaseProps) {
  return <Mail aria-hidden {...props} />;
}
