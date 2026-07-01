/**
 * Typed wrappers over the plain-JS blog core (src/lib/blog.js). The core is JS
 * so `node --test` can cover the parsing/slug/sort logic without a TS build;
 * this module gives the TS callers (the listing, post page, OG route) a typed
 * surface and a shared `Post` type.
 */
import {
  getAllPosts as getAllPostsJs,
  getPostBySlug as getPostBySlugJs,
  estimateReadingMinutes as estimateReadingMinutesJs,
} from "./blog.js";

export type Post = {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  excerpt: string;
  /** Cover image filename (a key into src/lib/blog-images.ts), if any. */
  coverKey?: string;
  /** Raw MDX body, to be compiled on the post page. */
  content: string;
};

export function getAllPosts(): Post[] {
  return getAllPostsJs() as Post[];
}

export function getPostBySlug(slug: string): Post | null {
  return getPostBySlugJs(slug) as Post | null;
}

/**
 * Typed wrapper over the pure JS reading-time core. Named to match the core
 * export so the `./blog.js` import resolves under TypeScript (which maps the
 * `.js` specifier to this sibling `.ts` at type-check time), exactly like the
 * `getAllPosts`/`getPostBySlug` wrappers above.
 */
export function estimateReadingMinutes(content: string): number {
  return estimateReadingMinutesJs(content);
}

/**
 * Estimated reading time for a post, in whole minutes (always >= 1). Delegates
 * to the pure JS core so the estimate is unit-tested without a TS build.
 */
export function readingMinutes(post: Post): number {
  return estimateReadingMinutes(post.content);
}

/**
 * Format a YYYY-MM-DD date string as a human-readable date (e.g.
 * "June 30, 2026"). Parsed as UTC so the rendered date never shifts by a day
 * in a negative-offset timezone.
 */
export function formatPostDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
