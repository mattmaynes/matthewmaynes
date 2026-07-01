/**
 * Typed wrappers over the plain-JS blog core (src/lib/blog.js). The core is JS
 * so `node --test` can cover the parsing/slug/sort logic without a TS build;
 * this module gives the TS callers (the listing, post page, OG route) a typed
 * surface and a shared `Post` type.
 */
import {
  getAllPosts as getAllPostsJs,
  getPostBySlug as getPostBySlugJs,
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
