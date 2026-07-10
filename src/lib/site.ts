/**
 * Site-wide constants: the shared `site` object (identity fields from ./identity
 * plus site-only metadata), the navigation list, and the staged image metadata.
 * Identity / social data lives in ./identity so the resume PDF freshness hash can
 * key on that file alone - nav or image edits here no longer flag the PDF stale.
 * Images are static-imported so next/image gets real pixel dimensions (no layout
 * shift) and a build-time blurDataURL for `placeholder="blur"`. No PII by design.
 */
import type { StaticImageData } from "next/image";
import { identity, socialPath, twitterHandle } from "./identity";
// Photos are JPEG (smaller than PNG for photographic content); the eagle-snap
// banner is a flat graphic and stays PNG (smaller than JPEG for that).
import areaILive from "../../public/images/area-i-live.jpg";
import headshotImg from "../../public/images/headshot.jpg";
import familyImg from "../../public/images/family.jpg";
import sashaImg from "../../public/images/sasha-best-dog-ever.jpg";
import babyMatthewImg from "../../public/images/baby-matthew.jpg";
import eagleSnapImg from "../../public/images/eagle-snap.png";

// Re-export the identity helpers so existing `@/lib/site` importers keep working
// while the data lives in the single, hash-keyed ./identity module.
export { socialPath, twitterHandle };

export const site = {
  ...identity,
  tagline: "An endlessly curious problem solver who can't help but build things",
  // One shared description: the <meta>, Open Graph, Twitter card, and manifest all
  // read this so the link preview, search snippet, and install prompt never drift.
  description:
    "Personal site of Matthew Maynes, an engineering leader who builds things, plants trees, and leads by example.",
  // Alt text for the generated share card (opengraph-image).
  ogImageAlt: "Matthew Maynes - Engineering Director",
} as const;

/** One title for the RSS feed, shared by the feed channel and the `<link
 *  rel="alternate">` autodiscovery on the blog surfaces, so the three never
 *  drift (spec 0013). */
export const blogFeedTitle = `${site.name} - Blog`;

export type NavItem = { href: string; label: string };

// The header and the sitemap both derive from this list, in this order.
export const nav: readonly NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/resume", label: "Resume" },
  { href: "/projects", label: "Projects" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
] as const;

/**
 * A staged image: the static import (carries src, width, height, and the
 * generated blurDataURL) plus its alt text. Pass the whole object as a
 * next/image `src` to get auto dimensions and `placeholder="blur"`.
 */
export type SiteImage = StaticImageData & { alt: string };

export const images = {
  areaILive: {
    ...areaILive,
    alt: "Forested property at golden hour, the kind of place Matthew lives and plants trees.",
  },
  headshot: {
    ...headshotImg,
    alt: "Professional headshot of Matthew Maynes.",
  },
  family: {
    ...familyImg,
    alt: "Matthew Maynes with his family outdoors.",
  },
  sasha: {
    ...sashaImg,
    alt: "Sasha, the golden doodle, looking like the best dog ever.",
  },
  babyMatthew: {
    ...babyMatthewImg,
    alt: "Matthew Maynes as a small child.",
  },
  eagleSnap: {
    ...eagleSnapImg,
    alt: "Eagle SNAP project banner.",
  },
} satisfies Record<string, SiteImage>;
