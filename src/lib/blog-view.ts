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

/** The searchable fields plus the single category `filterByCategory` narrows on. */
export type CategorizedPost = FilterablePost & { category: string };

/**
 * The fixed set of post categories (spec 0038), in canonical order. One category
 * per post, unlike free-form `tags` - this is the controlled taxonomy the `/blog`
 * filter and the category archives operate on. Array order is the chip order on
 * the listing and the order categories appear in the sitemap. Adding a category
 * here (and to a post) is all it takes to introduce one; the build rejects any
 * post whose category is not in this list, so the set cannot silently drift.
 */
export const CATEGORIES = [
  "Engineering",
  "Leadership",
  "Career",
  "AI",
  "Projects",
  "Life",
] as const;

/** One of the fixed post categories. */
export type Category = (typeof CATEGORIES)[number];

/** Whether a raw string is one of the fixed categories (case-sensitive - the
 *  frontmatter must use the canonical casing, which the build enforces). */
export function isCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}

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
  /** The post's single category (spec 0038); drives the row's category badge. */
  category: Category;
  cover?: Cover;
  pixelated: boolean;
  /** Focal point for the ratio-cropped thumbnail; `"top"` keeps a tall portrait's
   *  top (a face) in frame. Absent/`"center"` centre-crops. */
  coverFocus?: "top" | "center";
  isNew: boolean;
  /** Series name (e.g. "Life Log"), if the post belongs to one; drives the
   *  series pill on the row. Absent = standalone post. */
  series?: string;
  /** Estimated reading time in whole minutes (server-computed, spec 0015). */
  minutes: number;
  /** URL base the row links under - "/blog" for published rows, "/blog/drafts"
   *  for the drafts index (spec 0034). The href is `${basePath}/${slug}`. */
  basePath: string;
  /** For a row in the /blog/drafts preview index (spec 0035): whether it is a
   *  draft or a scheduled post, driving the row's "Draft"/"Scheduled" marker.
   *  Absent on a published row. */
  previewState?: "draft" | "scheduled";
  /** For a scheduled preview row: the formatted `publishAt` shown in the marker
   *  (e.g. "July 19, 2026 at 7:00 p.m."). Absent unless previewState is
   *  "scheduled". */
  publishAtLabel?: string;
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
 * Format a scheduled post's ISO 8601 `publishAt` for the "Scheduled for ..."
 * preview marker (spec 0035), e.g. "July 19, 2026, 7:00 p.m. (UTC-4)". Unlike
 * `formatPostDate` this keeps the time, and renders the wall-clock in the
 * timestamp's OWN offset (the offset it carries, or UTC for a bare datetime) so
 * the author sees the instant they scheduled rather than the server's zone. Works
 * for ANY offset, including half-hour zones like +05:30, by shifting the UTC
 * instant rather than routing through whole-hour-only Etc/GMT zones. Client-safe
 * (no fs), so both the Server Component preview and any client caller share one
 * formatter. Returns the raw string unchanged if it does not parse (belt-and-
 * suspenders; the build already rejects an unparseable publishAt).
 */
export function formatPublishAt(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const offsetMin = offsetMinutesFromIso(iso);
  // Shift the UTC instant by the post's own offset, then format the components in
  // UTC: the numbers shown are the wall-clock in that offset, on any server zone.
  const wall = new Date(ms + offsetMin * 60_000).toLocaleString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `${wall} (${offsetLabel(offsetMin)})`;
}

/** The UTC offset in MINUTES carried by an ISO 8601 string: an explicit "Z", or
 *  a bare datetime (which Date.parse reads as UTC), is 0; "+/-HH:MM" or "+/-HHMM"
 *  is honoured with its minutes, so half-hour zones (e.g. +05:30) are exact. */
function offsetMinutesFromIso(iso: string): number {
  if (/[zZ]$/.test(iso)) return 0;
  const m = /([+-])(\d{2}):?(\d{2})$/.exec(iso);
  if (!m) return 0; // bare "YYYY-MM-DDTHH:MM" -> UTC, matching Date.parse.
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/** A human, unambiguous offset label: "UTC", "UTC-4", or "UTC+5:30". */
function offsetLabel(offsetMin: number): string {
  if (offsetMin === 0) return "UTC";
  const sign = offsetMin < 0 ? "-" : "+";
  const abs = Math.abs(offsetMin);
  const h = Math.floor(abs / 60);
  const mm = abs % 60;
  return `UTC${sign}${h}${mm ? `:${String(mm).padStart(2, "0")}` : ""}`;
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
 * Whether a post matches a search query over title + excerpt + tags,
 * case-insensitively. An empty query matches everything. The single search
 * predicate shared by `filterPosts` (tag archives) and `filterByCategory` (the
 * listing), so the searchable-field set is defined once. `q` is expected already
 * trimmed + lowercased by the caller.
 */
function matchesQuery(post: FilterablePost, q: string): boolean {
  if (!q) return true;
  const haystack =
    `${post.title} ${post.excerpt} ${post.tags.join(" ")}`.toLowerCase();
  return haystack.includes(q);
}

/**
 * Filter posts by an active tag (or null for all) and then narrow by a search
 * query over title + excerpt + tags. Both matches are case-insensitive; the two
 * conditions compose (a post must pass both). Returns a new array - the input is
 * never mutated. Drives the `/blog/tags/*` archives.
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
    return matchesQuery(post, q);
  });
}

/**
 * Filter posts by an active category (or null for all) and then narrow by the
 * same title + excerpt + tags search. This is the `/blog` listing filter (spec
 * 0038) and the category archive filter: a post has exactly one category, so the
 * match is an exact (case-insensitive) equality, not tag-style membership. Both
 * conditions compose; the input is never mutated.
 */
export function filterByCategory<T extends CategorizedPost>(
  posts: T[],
  activeCategory: string | null,
  query: string,
): T[] {
  const q = (query ?? "").trim().toLowerCase();
  const cat = activeCategory ? activeCategory.toLowerCase() : null;
  return posts.filter((post) => {
    if (cat && post.category.toLowerCase() !== cat) return false;
    return matchesQuery(post, q);
  });
}

/**
 * The categories that actually have posts, in canonical `CATEGORIES` order (not
 * first-appearance order like `deriveTags`, since the taxonomy is fixed). Empty
 * categories are omitted so the listing never shows a chip that filters to
 * nothing. Does not mutate its input.
 */
export function deriveCategories(posts: { category: string }[]): Category[] {
  const present = new Set(posts.map((p) => p.category.toLowerCase()));
  return CATEGORIES.filter((c) => present.has(c.toLowerCase()));
}

/**
 * Resolve a raw `?category=` value back to a known present category,
 * case-insensitively. Returns the canonical-cased category from `allCategories`
 * or null for an unknown or empty value - i.e. "All posts".
 */
export function resolveActiveCategory(
  rawCategory: string,
  allCategories: string[],
): string | null {
  if (!rawCategory) return null;
  const lower = rawCategory.toLowerCase();
  return allCategories.find((c) => c.toLowerCase() === lower) ?? null;
}

/** The URL slug for a category (same rules as a post/tag slug). */
export function categorySlug(category: string): string {
  return slugify(category);
}

/**
 * Resolve a category slug back to its canonical-cased category, or null if no
 * known category slugifies to it. Mirrors `tagFromSlug`; `slug` is re-slugified
 * first so an odd-cased inbound value still matches.
 */
export function categoryFromSlug(
  slug: string,
  categories: string[],
): string | null {
  const s = slugify(slug);
  return categories.find((c) => categorySlug(c) === s) ?? null;
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
