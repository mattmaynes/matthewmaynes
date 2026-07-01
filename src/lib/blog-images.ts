/**
 * Blog image registry - static-imported cover + inline images, keyed by their
 * filename, each with alt text. Mirrors the `images` map in src/lib/site.ts:
 * static imports carry src/width/height and a build-time blurDataURL, so passing
 * the whole object as a next/image `src` gets real dimensions (no layout shift)
 * and `placeholder="blur"` (no pop-in flicker, learnings 0005).
 *
 * `pixelated` flags pixel-art assets that must render nearest-neighbour and must
 * never be blur-upscaled (the Turing cover).
 */
import type { StaticImageData } from "next/image";
import turingSunrise from "../../public/images/blog/turing-sunrise.png";
import zombieHordeTitle from "../../public/images/blog/zombie-horde-title.png";
import eagleSnap from "../../public/images/blog/eagle-snap.png";

import type { SiteImage } from "./site";

/** A blog image: the static import + alt text, plus a pixel-art flag. */
export type BlogImage = SiteImage & { pixelated?: boolean };

export const blogImages = {
  "turing-sunrise.png": {
    ...turingSunrise,
    alt: "Pixel-art sunrise rendered in Turing, from the game Zombie Horde.",
    pixelated: true,
  },
  "zombie-horde-title.png": {
    ...zombieHordeTitle,
    alt: "The chrome 'ZOMBIE HORDE' title graphic.",
  },
  "eagle-snap.png": {
    ...eagleSnap,
    alt: "Screenshots of the Eagle SNAP iPad app: a runway condition report form and its report-type menu.",
  },
} satisfies Record<string, BlogImage>;

export type BlogImageKey = keyof typeof blogImages;

/**
 * Resolve an image by filename, tolerating the `.png` being omitted (the
 * <PostImage name="..."/> in the MDX uses the bare name). Returns undefined for
 * an unknown key so callers can decide how to handle a missing asset.
 */
export function getBlogImage(name: string): BlogImage | undefined {
  const key = (name.endsWith(".png") ? name : `${name}.png`) as BlogImageKey;
  return blogImages[key] as BlogImage | undefined;
}

export type { StaticImageData };
