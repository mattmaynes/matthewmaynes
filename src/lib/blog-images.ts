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
import sheaAndSasha from "../../public/images/blog/shea-and-sasha.jpg";
import sheaPlayGym from "../../public/images/blog/shea-play-gym.jpg";
import sashaRunning from "../../public/images/blog/sasha-running.jpg";
import aiIdentityDesk from "../../public/images/blog/ai-identity-desk.png";
import memoryKeeperIdeaBrowser from "../../public/images/blog/memory-keeper-idea-browser.png";
import memoryKeeperLogin from "../../public/images/blog/memory-keeper-login.png";
import memoryKeeperHome from "../../public/images/blog/memory-keeper-home.png";
import memoryKeeperSettings from "../../public/images/blog/memory-keeper-settings.png";
import memoryKeeper404 from "../../public/images/blog/memory-keeper-404.png";

import type { SiteImage } from "./site";

/** A blog image: the static import + alt text, a pixel-art flag, and an optional
 *  focal point for cropped renders (the listing thumbnail and the OG card crop a
 *  cover to a fixed ratio; `focus: "top"` keeps the top of a tall portrait -
 *  e.g. a face - in frame instead of centre-cropping it out). Default is centre. */
export type BlogImage = SiteImage & {
  pixelated?: boolean;
  focus?: "top" | "center";
};

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
  "shea-and-sasha.jpg": {
    ...sheaAndSasha,
    alt: "A baby in a pale pink bunny-print sleeper resting against Sasha, the family's fluffy white curly-coated dog, on a bed, looking at the camera.",
    // A tall portrait: top-align the cropped renders so the baby's head stays in
    // frame on the listing thumbnail and the OG card.
    focus: "top",
  },
  "shea-play-gym.jpg": {
    ...sheaPlayGym,
    alt: "A baby doing tummy time on a butterfly-print blanket under a play gym, a hanging plush elephant above, looking up at the camera.",
  },
  "sasha-running.jpg": {
    ...sashaRunning,
    alt: "A white curly-coated dog running across a sunny green lawn toward the camera, tongue out, a treeline behind.",
  },
  "ai-identity-desk.png": {
    ...aiIdentityDesk,
    alt: "An open laptop on a wooden desk by a sunlit window, its screen filled with code in a dark editor, a quiet home office with bookshelves behind it.",
  },
  "memory-keeper-idea-browser.png": {
    ...memoryKeeperIdeaBrowser,
    alt: "An idea-tracker page titled 'Daily story recorder for families facing dementia', tagged 'Perfect Timing' and '10x Better', with a search-volume chart spiking to 165K and +12592% growth and opportunity, problem, feasibility and business-fit scores.",
  },
  "memory-keeper-login.png": {
    ...memoryKeeperLogin,
    alt: "The MemoryKeeper app's 'Get Started now' login screen with Log In and Sign Up tabs, an email field pre-filled with a blurred-out address, an empty password field, and a blue Log In button.",
  },
  "memory-keeper-home.png": {
    ...memoryKeeperHome,
    alt: "The MemoryKeeper home screen: a 'Get Started' heading, a 'Create Memory' button, a generic story prompt about family traditions with a voice-recording control, and a Memory Bank list, all in a default untouched theme.",
  },
  "memory-keeper-settings.png": {
    ...memoryKeeperSettings,
    alt: "The MemoryKeeper settings screen with toggles for push notifications, daily reminders and haptic feedback, overlaid by a placeholder dialog reading 'Time Picker - Time picker would open here' with an OK button.",
  },
  "memory-keeper-404.png": {
    ...memoryKeeper404,
    alt: "A mobile Safari window at memorykeeper.app showing a bare '404 - Page not found.' error with a single Home link, reached by tapping the app's data policy button.",
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
