/**
 * Pure, fs-free view helpers for the blog listing. Split out from `blog.ts`
 * (which reads the filesystem via `getAllPosts`) so BOTH the Server Component
 * page and the `"use client"` listing island can import the SAME logic - the
 * island cannot import `blog.ts` because its import graph pulls in `node:fs`.
 * Kept fs-free so `node --test` covers the filter/tag logic without a server.
 */
import type { StaticImageData } from "next/image";

/** The post shape `filterPosts` narrows over: only the searchable fields. */
export type FilterablePost = { title: string; excerpt: string; tags: string[] };

/** A cover image passed down from the server: a static import (carrying its
 * blurDataURL) plus alt text. Resolved server-side via `getBlogImage` so a
 * client caller never imports `blog-images.ts` (learnings 0005). */
export type Cover = StaticImageData & { alt: string };

/** A serializable post summary rendered by `PostRow` on both the listing island
 * and the tag archive. The server resolves the cover and computes `isNew` (the
 * globally-newest post within the recency window) so the row renders straight
 * from props. The row's data contract lives here in the fs-free view core (not
 * in the component) so `src/lib` consumers like `post-summaries` do not import
 * up into `src/components`. */
export type PostRowData = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  tags: string[];
  cover?: Cover;
  pixelated: boolean;
  isNew: boolean;
  /** Estimated reading time in whole minutes (server-computed, spec 0015). */
  minutes: number;
};

/**
 * Format a YYYY-MM-DD date as "Month D, YYYY" (e.g. "June 28, 2026"). Parsed as
 * UTC midnight with a fixed locale so server and client render identically (no
 * hydration mismatch) and a negative-offset timezone never shifts the day.
 */
export function formatPostDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/**
 * The union of every post's tags in first-appearance order, deduplicated
 * case-insensitively (keeping the first-seen casing). Does not mutate its input.
 */
export function deriveTags(posts: { tags: string[] }[]): string[] {
  const tags: string[] = [];
  for (const post of posts) {
    for (const tag of post.tags) {
      if (!tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        tags.push(tag);
      }
    }
  }
  return tags;
}

/**
 * Resolve a raw `?tag=` value back to a known tag, case-insensitively. Returns
 * the matching tag from `allTags` (original casing) or null for an unknown or
 * empty value - i.e. "All".
 */
export function resolveActiveTag(
  rawTag: string,
  allTags: string[],
): string | null {
  if (!rawTag) return null;
  const lower = rawTag.toLowerCase();
  return allTags.find((t) => t.toLowerCase() === lower) ?? null;
}

/**
 * The tag-filter Combobox value that means "no filter" (the "All posts" entry).
 * An empty string mirrors the URL/server-snapshot convention (`readUrlTag`
 * returns "" for an absent `?tag=`), so the widget and the URL agree on "all".
 */
export const ALL_TAGS_FILTER_VALUE = "";

/**
 * Map a tag-filter Combobox value back to an active tag: the "all" sentinel
 * (empty string) becomes null (no filter); any other value is the tag itself.
 * The single seam between the single-select widget's always-string value and the
 * nullable tag the rest of the blog core speaks - kept pure so it is unit-tested
 * rather than trapped in the client island.
 */
export function tagFromFilterValue(value: string): string | null {
  return value === ALL_TAGS_FILTER_VALUE ? null : value;
}

/**
 * Filter posts by an active tag (or null for all) and then narrow by a search
 * query over title + excerpt + tags. Both matches are case-insensitive; the two
 * conditions compose (a post must pass both). Returns a new array - the input is
 * never mutated.
 */
export function filterPosts<T extends FilterablePost>(
  posts: T[],
  activeTag: string | null,
  query: string,
): T[] {
  const q = (query ?? "").trim().toLowerCase();
  const tag = activeTag ? activeTag.toLowerCase() : null;
  return posts.filter((post) => {
    if (tag && !post.tags.some((t) => t.toLowerCase() === tag)) {
      return false;
    }
    if (q) {
      const haystack =
        `${post.title} ${post.excerpt} ${post.tags.join(" ")}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/**
 * Slugify a string: lowercase, non-alphanumerics collapse to a single dash,
 * trim leading/trailing dashes. e.g. "I Picked the Wrong Elective" ->
 * "i-picked-the-wrong-elective". The one slugifier for the whole blog - post
 * filenames (via `blog.ts`, which re-exports this) and tag URLs share it, so a
 * tag page's slug always matches how a post's slug is derived.
 */
export function slugify(s: string): string {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The URL slug for a tag (same rules as a post slug). */
export function tagSlug(tag: string): string {
  return slugify(tag);
}

/**
 * Resolve a tag slug back to its original-cased tag, or null if no known tag
 * slugifies to it. `slug` is re-slugified first so an odd-cased inbound value
 * still matches (idempotent). First match wins - two distinct tags that
 * slugify identically (e.g. "A.I." vs "AI") is not expected at this scale, and
 * `deriveTags` already dedupes tags case-insensitively.
 */
export function tagFromSlug(slug: string, tags: string[]): string | null {
  const s = slugify(slug);
  return tags.find((t) => tagSlug(t) === s) ?? null;
}
