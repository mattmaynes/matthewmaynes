/**
 * Pure, fs-free view helpers for the blog listing. Split out from `blog.ts`
 * (which reads the filesystem via `getAllPosts`) so BOTH the Server Component
 * page and the `"use client"` listing island can import the SAME logic - the
 * island cannot import `blog.ts` because its import graph pulls in `node:fs`.
 * Kept fs-free so `node --test` covers the filter/tag logic without a server.
 */

/** The post shape `filterPosts` narrows over: only the searchable fields. */
export type FilterablePost = { title: string; excerpt: string; tags: string[] };

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
