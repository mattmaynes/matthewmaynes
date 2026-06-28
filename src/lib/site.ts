/**
 * Single source of truth for site-wide constants: identity, navigation, social
 * links, and the staged image metadata (real pixel dimensions, so next/image
 * reserves space and avoids layout shift). No PII lives here by design.
 */

export const site = {
  name: "Matthew Maynes",
  title: "Engineering Director",
  tagline:
    "Engineering leader by day, reforestation enthusiast by evening, dog dad around the clock.",
  location: "Ontario, Canada",
  url: process.env.SITE_URL ?? "https://matthewmaynes.com",
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

/** Real dimensions captured from the staged PNGs (sips). */
export const images = {
  areaILive: {
    src: "/images/area-i-live.png",
    width: 2048,
    height: 1536,
    alt: "Forested property at golden hour, the kind of place Matthew lives and plants trees.",
  },
  headshot: {
    src: "/images/headshot.png",
    width: 1478,
    height: 1574,
    alt: "Professional headshot of Matthew Maynes.",
  },
  family: {
    src: "/images/family.png",
    width: 1143,
    height: 1600,
    alt: "Matthew Maynes with his family outdoors.",
  },
  sasha: {
    src: "/images/sasha-best-dog-ever.png",
    width: 1537,
    height: 2049,
    alt: "Sasha, the golden doodle, looking like the best dog ever.",
  },
  babyMatthew: {
    src: "/images/baby-matthew.png",
    width: 1148,
    height: 1744,
    alt: "Matthew Maynes as a small child.",
  },
  eagleSnap: {
    src: "/images/eagle-snap.png",
    width: 800,
    height: 400,
    alt: "Eagle SNAP project banner.",
  },
} satisfies Record<string, SiteImage>;
