/**
 * Typed wrappers over the plain-JS blog core (src/lib/blog.js). The core is JS
 * so `node --test` can cover the parsing/slug/sort logic without a TS build;
 * this module gives the TS callers (the listing, post page, OG route) a typed
 * surface and a shared `Post` type.
 */
import {
  getAllPosts as getAllPostsJs,
  getPostBySlug as getPostBySlugJs,
  getAdjacentPosts as getAdjacentPostsJs,
  estimateReadingMinutes as estimateReadingMinutesJs,
  isRecent as isRecentJs,
  newPostSlug as newPostSlugJs,
} from "./blog.js";

export type Post = {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  excerpt: string;
  /** Cover image filename (a key into src/lib/blog-images.ts), if any. */
  coverKey?: string;
  /** Optional caption shown under the cover; inline markdown (may carry a link). */
  coverCaption?: string;
  /** Raw MDX body, to be compiled on the post page. */
  content: string;
};

export function getAllPosts(): Post[] {
  return getAllPostsJs() as Post[];
}

export function getPostBySlug(slug: string): Post | null {
  return getPostBySlugJs(slug) as Post | null;
}

/** The chronological neighbours of a post: the older (`previous`) and newer
 *  (`next`) post, either `null` at a boundary. */
export type AdjacentPosts = { previous: Post | null; next: Post | null };

/**
 * Typed wrapper over the pure JS adjacency core (spec 0021): the older/newer
 * neighbours of `slug`, for previous/next post navigation. Named to match the core
 * export so the `./blog.js` import resolves under TypeScript, like the wrappers
 * above. Delegates to the JS so the ordering is unit-tested without a TS build.
 */
export function getAdjacentPosts(posts: Post[], slug: string): AdjacentPosts {
  return getAdjacentPostsJs(posts, slug) as AdjacentPosts;
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
 * Typed wrapper over the pure JS recency check. Named to match the core export
 * so the `./blog.js` import resolves under TypeScript (which maps the `.js`
 * specifier to this sibling `.ts` at type-check time), like the wrappers above.
 * True when `date` (YYYY-MM-DD) is within `days` of the injected `nowMs`.
 */
export function isRecent(date: string, nowMs: number, days: number): boolean {
  return isRecentJs(date, nowMs, days);
}

/**
 * Typed wrapper over the pure JS "which post is New" rule: the slug of the
 * newest post while it is still within the recency window, else null. Clock is
 * injected via `nowMs` so the badge logic stays deterministic and testable.
 */
export function newPostSlug(
  posts: Array<{ slug: string; date: string }>,
  nowMs: number,
  days = 30,
): string | null {
  return newPostSlugJs(posts, nowMs, days);
}

/**
 * Format a YYYY-MM-DD date string as a human-readable date (e.g. "June 28,
 * 2026"). Re-exported from the fs-free `blog-view.js` so the Server Component
 * post page and the `"use client"` listing island share ONE formatter (the
 * island cannot import this module, whose graph pulls in `node:fs`).
 */
export { formatPostDate } from "./blog-view.js";
