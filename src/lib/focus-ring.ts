/**
 * The site's shared focus-visible ring, in Harbor ring tokens: a 2px ring sitting
 * just off the element. One source of truth so every focusable card/link (the blog
 * listing rows, the previous/next post tiles, and future card surfaces) stays in
 * sync instead of each re-declaring the same class string. A plain string constant,
 * so it is safe to import into both Server Components and `"use client"` islands.
 */
export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset";
