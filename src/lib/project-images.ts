/**
 * Project image registry - cover art keyed by filename, mirroring
 * src/lib/blog-images.ts. Two kinds of cover:
 *
 * - Photos / screenshots are static-imported (carrying real dimensions and a
 *   build-time blurDataURL, so next/image renders them with `placeholder="blur"`
 *   and no layout shift) and rendered `object-cover`.
 * - The first-party rogueoak logos are SVGs referenced by their public path and
 *   rendered `unoptimized` (bypassing the image optimizer, so no
 *   `dangerouslyAllowSVG` config is needed) and `object-contain` on a neutral
 *   panel, so a wordmark is centred, not stretched.
 *
 * The loader stores only the `cover` filename key; the Server page resolves it
 * here via `getProjectImage`, so a client component never imports this module
 * (which pulls in the static image assets), the same boundary as blog-images.
 */
import type { StaticImageData } from "next/image";
import eagleSnap from "../../public/images/eagle-snap.png";
import headshot from "../../public/images/headshot.jpg";
import transformer from "../../public/images/projects/analyst-table-transformer.png";
import streamProcessor from "../../public/images/projects/kx-insights-stream-processor.png";
import rise from "../../public/images/projects/rise.webp";
import backDeck from "../../public/images/projects/back-deck.jpg";
import frontDeck from "../../public/images/projects/front-deck.jpg";
import multiLevelDeck from "../../public/images/projects/multi-level-deck.jpg";
import kitchen from "../../public/images/projects/kitchen-renovation.jpg";

/**
 * A resolved cover: the next/image `src` (a static import for raster art, or a
 * public-path string for an SVG logo), its alt text, how it fits the card frame,
 * whether a blur placeholder is available (raster only), and whether to bypass
 * the optimizer (first-party SVG only).
 */
export type ProjectImage = {
  src: StaticImageData | string;
  alt: string;
  fit: "cover" | "contain";
  blur: boolean;
  unoptimized: boolean;
};

/** A static-imported raster cover (photo or screenshot): blur, optimized. */
function raster(
  src: StaticImageData,
  alt: string,
  fit: "cover" | "contain" = "cover",
): ProjectImage {
  return { src, alt, fit, blur: true, unoptimized: false };
}

/** A first-party SVG logo cover: contained on a panel, unoptimized, no blur. */
function logo(src: string, alt: string): ProjectImage {
  return { src, alt, fit: "contain", blur: false, unoptimized: true };
}

export const projectImages = {
  "eagle-snap.png": raster(
    eagleSnap,
    "The Eagle SNAP app on an iPad: a runway condition report form.",
  ),
  "analyst-table-transformer.png": raster(
    transformer,
    "The KX Analyst table transformer: a time-series table beside a menu of column transform operations.",
  ),
  "kx-insights-stream-processor.png": raster(
    streamProcessor,
    "A KX Insights Stream Processor pipeline diagram: two Read stages feeding Parse stages into a Write stage.",
    "contain",
  ),
  "rise.webp": raster(
    rise,
    "The Rise marketing dashboard in Constant Contact: a welcome screen with campaign performance metrics.",
  ),
  "back-deck.jpg": raster(
    backDeck,
    "A finished multi-level cedar back deck with wide steps beside a blue-grey house.",
  ),
  "front-deck.jpg": raster(
    frontDeck,
    "A new cedar front porch with wood railings and a fresh garden bed in front of a blue-grey house.",
  ),
  "multi-level-deck.jpg": raster(
    multiLevelDeck,
    "A large multi-level backyard deck with black railings and landscaped garden beds beside a grey two-storey house.",
  ),
  "kitchen-renovation.jpg": raster(
    kitchen,
    "A renovated open kitchen with white and sage-green cabinetry, quartz counters, and pendant lighting.",
  ),
  "headshot.jpg": raster(headshot, "Matthew Maynes."),
  "spectra-logo.svg": logo("/images/projects/spectra-logo.svg", "Spectra logo."),
  "trellis-logo.svg": logo("/images/projects/trellis-logo.svg", "Trellis logo."),
  "canopy-logo.svg": logo("/images/projects/canopy-logo.svg", "Canopy logo."),
  "rogueoak-logo.svg": logo("/images/projects/rogueoak-logo.svg", "rogueoak logo."),
} satisfies Record<string, ProjectImage>;

export type ProjectImageKey = keyof typeof projectImages;

/**
 * Resolve a cover by its filename key. Returns undefined for an absent or
 * unknown key so the card can render coverless rather than crash on a typo.
 */
export function getProjectImage(name?: string): ProjectImage | undefined {
  if (!name) return undefined;
  return projectImages[name as ProjectImageKey] as ProjectImage | undefined;
}
