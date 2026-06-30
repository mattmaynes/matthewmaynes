/**
 * Single source of truth for site-wide constants: identity, navigation, social
 * links, and the staged image metadata. Images are static-imported so next/image
 * gets real pixel dimensions (no layout shift) and a build-time blurDataURL for
 * `placeholder="blur"` (no pop-in flicker). No PII lives here by design.
 */
import type { StaticImageData } from "next/image";
import areaILive from "../../public/images/area-i-live.png";
import headshotImg from "../../public/images/headshot.png";
import familyImg from "../../public/images/family.png";
import sashaImg from "../../public/images/sasha-best-dog-ever.png";
import babyMatthewImg from "../../public/images/baby-matthew.png";
import eagleSnapImg from "../../public/images/eagle-snap.png";

export const site = {
  name: "Matthew Maynes",
  title: "Engineering Director",
  tagline: "Engineering leader that loves the outdoors.",
  location: "Ontario, Canada",
  // One shared description: the <meta>, Open Graph, Twitter card, and manifest all
  // read this so the link preview, search snippet, and install prompt never drift.
  description:
    "Personal site of Matthew Maynes, an engineering leader who builds things, plants trees, and leads by example.",
  // Alt text for the generated share card (opengraph-image).
  ogImageAlt: "Matthew Maynes - Engineering Director",
  // Read at build time for static metadata (metadataBase). Use `||` (not `??`) so
  // an empty-string SITE_URL falls back instead of throwing in new URL("").
  url: process.env.SITE_URL || "https://matthewmaynes.com",
  social: {
    linkedin: "https://www.linkedin.com/in/matthew-maynes/",
    github: "https://github.com/mattmaynes",
    x: "https://x.com/mattmaynes",
  },
} as const;

/** Twitter/X handle derived from the profile URL (e.g. "@mattmaynes"). */
export const twitterHandle = `@${new URL(site.social.x).pathname.replace(/\//g, "")}`;

export type NavItem = { href: string; label: string };

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
