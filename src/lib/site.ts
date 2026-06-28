/**
 * Single source of truth for site-wide constants: identity, navigation, social
 * links, and the staged image metadata (real pixel dimensions, so next/image
 * reserves space and avoids layout shift). No PII lives here by design.
 */

export const site = {
  name: "Matthew Maynes",
  title: "Engineering Director",
  tagline: "Engineering leader that loves the outdoors.",
  location: "Ontario, Canada",
  // Read at build time for static metadata (metadataBase). Use `||` (not `??`) so
  // an empty-string SITE_URL falls back instead of throwing in new URL("").
  url: process.env.SITE_URL || "https://matthewmaynes.com",
  social: {
    linkedin: "https://www.linkedin.com/in/matthew-maynes/",
    github: "https://github.com/mattmaynes",
  },
} as const;

export type NavItem = { href: string; label: string };

export const nav: readonly NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/resume", label: "Resume" },
  { href: "/projects", label: "Projects" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
] as const;

export type SiteImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
};

/** Real dimensions captured from the optimized PNGs (sips -Z + pngquant). */
export const images = {
  areaILive: {
    src: "/images/area-i-live.png",
    width: 1800,
    height: 1350,
    alt: "Forested property at golden hour, the kind of place Matthew lives and plants trees.",
  },
  headshot: {
    src: "/images/headshot.png",
    width: 845,
    height: 900,
    alt: "Professional headshot of Matthew Maynes.",
  },
  family: {
    src: "/images/family.png",
    width: 786,
    height: 1100,
    alt: "Matthew Maynes with his family outdoors.",
  },
  sasha: {
    src: "/images/sasha-best-dog-ever.png",
    width: 975,
    height: 1300,
    alt: "Sasha, the golden doodle, looking like the best dog ever.",
  },
  babyMatthew: {
    src: "/images/baby-matthew.png",
    width: 790,
    height: 1200,
    alt: "Matthew Maynes as a small child.",
  },
  eagleSnap: {
    src: "/images/eagle-snap.png",
    width: 800,
    height: 400,
    alt: "Eagle SNAP project banner.",
  },
} satisfies Record<string, SiteImage>;
