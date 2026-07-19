/**
 * Blog video registry - self-hosted MP4 clips embedded in posts via
 * <PostVideo name="..."/>, keyed by filename. Mirrors src/lib/blog-images.ts,
 * but a video is not statically imported (there is no blurDataURL or dimension
 * inference), so each entry carries its own public `src` path plus intrinsic
 * `width`/`height` (to reserve the correct aspect ratio, so the player does not
 * shift layout as it loads) and an accessible `alt` label.
 *
 * The files live under public/videos/blog and are served statically. They are
 * our own tracked assets, transcoded to browser-safe H.264 (yuv420p) with all
 * metadata - including any embedded GPS location - stripped before they are
 * registered here, so there is no third-party embed and nothing to leak.
 */

/** A blog video: its public path, intrinsic dimensions, alt text, and poster. */
export type BlogVideo = {
  /** Public path to the MP4 (served from /public). */
  src: string;
  /** Intrinsic pixel width, to reserve the aspect ratio (no layout shift). */
  width: number;
  /** Intrinsic pixel height. */
  height: number;
  /** Accessible description of the clip. */
  alt: string;
  /** Optional poster still shown before playback (a public path). */
  poster?: string;
};

export const blogVideos = {
  "wildfire-smoke.mp4": {
    src: "/videos/blog/wildfire-smoke.mp4",
    width: 720,
    height: 1280,
    alt: "A hazy, smoke-yellowed sky dimming the daylight over a rural lawn, a quiet road and a distant treeline, wildfire smoke drifting in from far away.",
    poster: "/videos/blog/wildfire-smoke-poster.jpg",
  },
} satisfies Record<string, BlogVideo>;

export type BlogVideoKey = keyof typeof blogVideos;

/**
 * Resolve a video by filename, tolerating the `.mp4` being omitted (the
 * <PostVideo name="..."/> in the MDX may use the bare name). Returns undefined
 * for an unknown key so the caller (PostVideo) can fail the build loudly.
 */
export function getBlogVideo(name: string): BlogVideo | undefined {
  const direct = blogVideos[name as BlogVideoKey];
  if (direct) return direct as BlogVideo;
  const key = (name.endsWith(".mp4") ? name : `${name}.mp4`) as BlogVideoKey;
  return blogVideos[key] as BlogVideo | undefined;
}
