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
import houseQuicksand from "../../public/images/blog/house-quicksand.png";
import snowyRunway from "../../public/images/blog/snowy-runway.png";
import analystTableTransformer from "../../public/images/blog/analyst-table-transformer.png";
import streamProcessorDesk from "../../public/images/blog/stream-processor-desk.png";
import redMazda3 from "../../public/images/blog/red-mazda-3.png";
import sheaOnSheepskin from "../../public/images/blog/shea-on-sheepskin.jpg";
import sheaPlayGym from "../../public/images/blog/shea-play-gym.jpg";
import sashaRunning from "../../public/images/blog/sasha-running.jpg";

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
  "house-quicksand.png": {
    ...houseQuicksand,
    alt: "A two-storey house sinking and buckling into a swirling pool of black quicksand, surrounded by scattered debris and swampland.",
  },
  "snowy-runway.png": {
    ...snowyRunway,
    alt: "An airliner on final approach to a snow-covered runway under a heavy grey sky, an airport terminal behind it.",
  },
  "analyst-table-transformer.png": {
    ...analystTableTransformer,
    alt: "The KX Analyst table transformer: a visual node graph of a data pipeline above a time-series table, with a menu of column transform operations open.",
  },
  "stream-processor-desk.png": {
    ...streamProcessorDesk,
    alt: "A desk by a window with a monitor showing q stream-processor code beside a pipeline diagram, a whiteboard behind it sketching determinism, exactly-once, checkpoints and failure recovery, an open notebook, and a KX-branded mug and book.",
  },
  "red-mazda-3.png": {
    ...redMazda3,
    alt: "A red 2008 Mazda 3 photographed head-on in a residential parking area under a grey winter sky, bare trees and suburban houses behind it.",
  },
  "shea-on-sheepskin.jpg": {
    ...sheaOnSheepskin,
    alt: "A baby in a lavender sleeper reclining against a fluffy cream sheepskin on a bed, a bassinet in the background.",
  },
  "shea-play-gym.jpg": {
    ...sheaPlayGym,
    alt: "A baby doing tummy time on a butterfly-print blanket under a play gym, a hanging plush elephant above, looking up at the camera.",
  },
  "sasha-running.jpg": {
    ...sashaRunning,
    alt: "A white curly-coated dog running across a sunny green lawn toward the camera, tongue out, a treeline behind.",
  },
} satisfies Record<string, BlogImage>;

export type BlogImageKey = keyof typeof blogImages;

/**
 * Resolve an image by filename. Tries the exact key first (so a `.jpg` photo is
 * referenced by its full name), then falls back to the legacy convention where a
 * bare `<PostImage name="turing-sunrise"/>` implies a `.png`. Returns undefined
 * for an unknown key so callers can decide how to handle a missing asset.
 */
export function getBlogImage(name: string): BlogImage | undefined {
  const direct = blogImages[name as BlogImageKey];
  if (direct) return direct as BlogImage;
  const key = (name.endsWith(".png") ? name : `${name}.png`) as BlogImageKey;
  return blogImages[key] as BlogImage | undefined;
}

export type { StaticImageData };
