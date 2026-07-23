/**
 * Blog content loader - the single seam every blog surface (listing, post page,
 * per-post OG route) reads. The pure parsing/slug/sort/reading-time logic is
 * unit-tested by `node --test` (tests/blog.test.ts) directly against this module;
 * Node strips the types at load, so there is no separate build step.
 *
 * Frontmatter is hand-parsed (no `gray-matter` dep, per the repo's no-new-dep
 * tradition): the listing reads only frontmatter, cheaply, and MDX is compiled
 * only on the post page (src/components/post-body.tsx). We only ever read our
 * own tracked files under content/blog/, never user input.
 */

import { readFileSync, readdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { CATEGORIES, formatPostDate, isCategory, slugify } from "./blog-view.ts";

// Re-export the shared slugifier so existing `@/lib/blog` importers (and the
// unit tests) keep resolving `slugify` here, while there is a single
// implementation, in the fs-free `blog-view` core.
export { slugify };

/** A blog post: frontmatter fields plus the raw MDX body (compiled on the page). */
export type Post = {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  /** The post's single theme (spec 0038), one of `CATEGORIES`. Drives the
   *  category filter, the category badge, and the /blog/categories archive. */
  category: string;
  excerpt: string;
  /** Cover image filename (a key into src/lib/blog-images.ts), if any. */
  coverKey?: string;
  /** Optional caption shown under the cover; inline markdown (may carry a link). */
  coverCaption?: string;
  /** Series this post belongs to (e.g. "Life Log"), if any. Drives the series
   *  sash on the hero and the series pill on listing rows. Absent = standalone. */
  series?: string;
  /** True for an unpublished draft: hidden from every public surface, reachable
   *  only under /blog/drafts (spec 0034). Absent frontmatter key = published. */
  draft?: boolean;
  /** ISO 8601 timestamp to publish this post at (spec 0035). While it is in the
   *  future the post is "scheduled" - hidden from every public surface and
   *  previewable under /blog/drafts - and flips live on its own once the time
   *  passes. Absent = publishes immediately (subject to `draft`). A bare
   *  datetime with no offset is read as UTC. `draft` wins: a draft is never
   *  scheduled. */
  publishAt?: string;
  /** Raw MDX body, to be compiled on the post page. */
  content: string;
};

/** The parsed frontmatter block: the known keys we read off each post. */
export type Frontmatter = {
  title: string;
  date: string;
  tags: string[];
  /** One of `CATEGORIES` (spec 0038); enum-validated at parse time. */
  category: string;
  excerpt: string;
  cover?: string;
  coverCaption?: string;
  /** Series name (e.g. "Life Log"); absent = standalone post. */
  series?: string;
  /** `draft: true` marks the post unpublished (spec 0034); absent = published. */
  draft?: boolean;
  /** ISO 8601 time to auto-publish at (spec 0035); absent = publish immediately. */
  publishAt?: string;
};

// Re-exported so the Server Component post page and the `"use client"` listing
// island share ONE date formatter (the island cannot import this module, whose
// graph pulls in `node:fs`).
export { formatPostDate };

// content/blog lives at the repo root; resolve relative to process.cwd() (the
// project root at build time, where `next build` runs and enumerates posts).
const BLOG_DIR = join(process.cwd(), "content", "blog");

/**
 * The content directories to read posts from. Production reads only content/blog.
 * Tests inject an EXTRA dir via `BLOG_FIXTURES_DIR` (absolute, or cwd-relative) so
 * the preview/gate behaviour can be exercised against real .mdx WITHOUT shipping
 * sample posts on the live site. Unset in prod, so behaviour there is unchanged.
 */
function blogDirs(): string[] {
  const extra = process.env.BLOG_FIXTURES_DIR;
  if (!extra) return [BLOG_DIR];
  return [BLOG_DIR, isAbsolute(extra) ? extra : join(process.cwd(), extra)];
}

// Frontmatter fields that must be present, or the build fails loudly.
const REQUIRED_FIELDS = ["title", "date", "tags", "category", "excerpt"] as const;

/**
 * Parse a leading `---\n ... \n---` frontmatter block plus the MDX body.
 * Reads only our known keys: title, date, excerpt, cover, coverCaption (strings)
 * and tags (an inline array like `[Life]` or `[A, B]`). Throws if the block is
 * missing or a required field (title, date, tags, excerpt) is absent.
 *
 * @param raw - the full .mdx file contents
 */
export function parseFrontmatter(raw: string): {
  data: Frontmatter;
  content: string;
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    throw new Error("Missing frontmatter block (expected a leading '---' fence)");
  }
  const [, block, body] = match;

  const data: Record<string, string | string[] | boolean> = {};
  for (const line of block.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1];
    const value = kv[2].trim();

    if (key === "tags") {
      // Inline array: [Life] or [A, B]. Strip the brackets and split.
      const inner = value.replace(/^\[/, "").replace(/\]$/, "").trim();
      data.tags = inner
        ? inner.split(",").map((t) => stripQuotes(t.trim())).filter(Boolean)
        : [];
    } else if (key === "draft") {
      // Boolean flag (spec 0034): only a literal `true` marks a draft; any other
      // value, or an absent key, is published. Not a required field.
      data.draft = stripQuotes(value) === "true";
    } else if (
      [
        "title",
        "date",
        "category",
        "excerpt",
        "cover",
        "coverCaption",
        "series",
        "publishAt",
      ].includes(key)
    ) {
      data[key] = stripQuotes(value);
    }
  }

  for (const field of REQUIRED_FIELDS) {
    const v = data[field];
    const missing =
      v === undefined ||
      v === "" ||
      (field === "tags" && (!Array.isArray(v) || v.length === 0));
    if (missing) {
      throw new Error(`Frontmatter is missing required field: ${field}`);
    }
  }

  // The category is a controlled taxonomy (spec 0038): reject anything outside the
  // fixed set loudly at build, so a typo or an off-list theme never ships and the
  // set cannot drift the way free-form tags did.
  if (typeof data.category !== "string" || !isCategory(data.category)) {
    throw new Error(
      `Frontmatter has an invalid category "${String(data.category)}" - must be one of: ${CATEGORIES.join(", ")}`,
    );
  }

  // A scheduling time (spec 0035) must be a real timestamp, or the build fails
  // loudly - a typo (e.g. `2026-13-40`) would otherwise silently leave the post
  // "scheduled" forever instead of publishing at the intended time.
  if (
    typeof data.publishAt === "string" &&
    Number.isNaN(Date.parse(data.publishAt))
  ) {
    throw new Error(`Frontmatter has an unparseable publishAt: ${data.publishAt}`);
  }

  return { data: data as unknown as Frontmatter, content: body };
}

/** Strip a single pair of matching surrounding quotes, if present. */
function stripQuotes(s: string): string {
  return s.replace(/^["'](.*)["']$/, "$1");
}

/** Words a typical adult reads per minute; the estimate divides by this. */
const WORDS_PER_MINUTE = 200;

/**
 * Estimate a post's reading time in whole minutes from its MDX body. Pure and
 * deterministic (no Date, no Math.random): strips the markup that is not prose
 * (fenced code blocks, JSX tags like PostImage, markdown link URLs, and inline
 * heading/emphasis markers) then counts the remaining whitespace-separated words
 * and divides by ~200 wpm. Floors at 1 so even a one-word post reads as
 * "1 min read".
 *
 * @param content - the raw MDX body (frontmatter already stripped)
 * @returns whole minutes, always >= 1
 */
export function estimateReadingMinutes(content: string): number {
  const prose = String(content ?? "")
    // Fenced code blocks - not prose, drop entirely.
    .replace(/```[\s\S]*?```/g, " ")
    // Inline code spans - drop the markup and its contents.
    .replace(/`[^`]*`/g, " ")
    // JSX/HTML tags such as <PostImage name="..."/> - drop the whole tag.
    .replace(/<[^>]+>/g, " ")
    // Markdown links [text](url): keep the link text, drop the URL.
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Bare markdown/emphasis markers left over.
    .replace(/[#>*_~`|-]+/g, " ");
  const words = prose.split(/\s+/).filter(Boolean);
  return Math.max(1, Math.round(words.length / WORDS_PER_MINUTE));
}

/** Reading time for a post, in whole minutes (always >= 1). */
export function readingMinutes(post: Post): number {
  return estimateReadingMinutes(post.content);
}

/** Milliseconds in one day, for the recency window. */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a post date is within `days` of a reference time. Pure and
 * deterministic - the caller injects `nowMs` (never `Date.now()` inside), so the
 * "New" badge logic is unit-testable with a fixed clock. `dateStr` is parsed as
 * UTC midnight, exactly like `formatPostDate`, so a negative-offset timezone
 * never shifts the boundary by a day. True when the post is published (not in the
 * future) and no older than `days` days; the window is inclusive at exactly N days.
 *
 * @param dateStr - a YYYY-MM-DD post date
 * @param nowMs - the reference time in epoch ms (injected)
 * @param days - the recency window, in days
 */
export function isRecent(dateStr: string, nowMs: number, days: number): boolean {
  const dateMs = Date.parse(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(dateMs)) return false;
  const ageMs = nowMs - dateMs;
  return ageMs >= 0 && ageMs <= days * DAY_MS;
}

/**
 * The slug of the post that should carry the "New" badge, or null. It is the
 * newest post (by date) but only while that post is still within the recency
 * window (`isRecent`), so the badge is not permanent furniture. Pure and
 * non-mutating (sorts a copy) and clock-injected via `nowMs`, so it is unit-
 * testable against a multi-post fixture with a fixed clock.
 *
 * @param nowMs - the reference time in epoch ms (injected)
 * @param days - the recency window, in days
 */
export function newPostSlug<T extends { slug: string; date: string }>(
  posts: T[],
  nowMs: number,
  days = 30,
): string | null {
  if (!Array.isArray(posts) || posts.length === 0) return null;
  // Ignore future-dated posts (a scheduled post or a `2027-` typo): otherwise
  // the newest-by-date entry is future, `isRecent` rejects it (age < 0), and the
  // badge would be suppressed on every post - including the genuinely-newest
  // published one. Pick the newest post that is already published.
  const published = posts.filter((p) => {
    const ms = Date.parse(`${p.date}T00:00:00Z`);
    return !Number.isNaN(ms) && ms <= nowMs;
  });
  if (published.length === 0) return null;
  const newest = sortPostsNewestFirst(published)[0];
  return isRecent(newest.date, nowMs, days) ? newest.slug : null;
}

/** A post source file: the directory it lives in and its `.mdx` filename. */
type PostFile = { dir: string; file: string };

/** Read + parse one .mdx file into a post record (frontmatter only, plus body). */
function readPost({ dir, file }: PostFile): Post {
  const slug = file.replace(/\.mdx$/, "");
  const raw = readFileSync(join(dir, file), "utf8");
  const { data, content } = parseFrontmatter(raw);
  // The slug is the filename; enforce that it matches the slugified title so a
  // filename/title drift fails the build loudly instead of shipping a URL that
  // does not read as the title (the documented content/blog naming rule).
  const expected = slugify(data.title);
  if (slug !== expected) {
    throw new Error(
      `Blog post filename slug "${slug}" does not match its title "${data.title}" (rename to "${expected}.mdx")`,
    );
  }
  return {
    slug,
    title: data.title,
    date: data.date,
    tags: data.tags,
    category: data.category,
    excerpt: data.excerpt,
    coverKey: data.cover,
    coverCaption: data.coverCaption,
    series: data.series,
    draft: data.draft === true,
    publishAt: data.publishAt,
    content,
  };
}

/** List the .mdx source files across the content dirs (empty if a dir is absent),
 *  each tagged with the directory it came from so `readPost` reads the right file. */
function listPostFiles(): PostFile[] {
  const out: PostFile[] = [];
  const seen = new Set<string>();
  for (const dir of blogDirs()) {
    try {
      for (const file of readdirSync(dir)) {
        if (!file.endsWith(".mdx")) continue;
        // De-dupe by slug (filename basename): content/blog (the first dir) wins, so
        // a same-named fixture never yields a duplicate post - which would otherwise
        // double up on /blog, the feed, sitemap, and generateStaticParams.
        const slug = file.replace(/\.mdx$/, "");
        if (seen.has(slug)) continue;
        seen.add(slug);
        out.push({ dir, file });
      }
    } catch {
      // dir absent - skip
    }
  }
  return out;
}

/**
 * Sort posts newest-first by `date`. Pure and non-mutating (copies first), so
 * `node --test` can cover the ordering without touching the filesystem.
 */
export function sortPostsNewestFirst<T extends { date: string }>(
  posts: T[],
): T[] {
  return [...posts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * All posts, newest-first by `date`. Parses frontmatter only (does NOT compile
 * MDX), so the listing is cheap. Slug is the filename basename.
 */
export function getAllPosts(): Post[] {
  return sortPostsNewestFirst(listPostFiles().map(readPost));
}

/**
 * The ISR revalidation window, in seconds, for every public blog surface
 * (spec 0035). The whole site is otherwise static, so a scheduled post would not
 * appear until the next deploy; each surface sets `export const revalidate = 60`
 * so it re-renders on this interval and re-runs the time-aware
 * `getPublishedPosts()`, and a post flips live on its own within ~a minute of its
 * `publishAt` (on the first request past the window; Next revalidation is
 * request-triggered, not a wall-clock timer).
 *
 * NOTE: this constant documents the window and is asserted by the unit tests, but
 * the routes must inline the literal `60` in their `export const revalidate` -
 * Next requires route segment config to be a statically-analyzable literal, so an
 * imported identifier is rejected ("Invalid segment configuration export").
 */
export const BLOG_REVALIDATE_SECONDS = 60;

/** A post's visibility state at a given instant (spec 0035). `draft` wins over
 *  `publishAt`, so a draft is never "scheduled". Pure - the caller injects
 *  `nowMs`, so it is unit-testable with a fixed clock. */
export function postState(
  post: { draft?: boolean; publishAt?: string },
  nowMs: number,
): "draft" | "scheduled" | "published" {
  if (post.draft) return "draft";
  if (post.publishAt && Date.parse(post.publishAt) > nowMs) return "scheduled";
  return "published";
}

/** Whether a post is publicly published as of `nowMs` (spec 0035). A thin
 *  wrapper over `postState` whose `Date.now()` default lives HERE, in this plain
 *  module, so a Server Component page can call `isPublishedNow(post)` without a
 *  `Date.now()` in its render body (react-hooks/purity, learnings 0012). */
export function isPublishedNow(
  post: { draft?: boolean; publishAt?: string },
  nowMs: number = Date.now(),
): boolean {
  return postState(post, nowMs) === "published";
}

/** Whether a post belongs to the not-yet-public preview area (draft or
 *  scheduled) as of `nowMs` (spec 0035). Same `Date.now()`-default rationale as
 *  `isPublishedNow`. */
export function isPreviewNow(
  post: { draft?: boolean; publishAt?: string },
  nowMs: number = Date.now(),
): boolean {
  return postState(post, nowMs) !== "published";
}

/**
 * Published posts only, newest-first. This is the set every PUBLIC surface
 * enumerates - the listing, home, subscribe, feed, sitemap, tag pages, the "New"
 * badge, and published post nav (spec 0034/0035). Time-aware: drafts and
 * not-yet-due scheduled posts are excluded as of `nowMs` (default now), so a
 * scheduled post simply is not in the set until its `publishAt` passes. A pure
 * derivation of `getAllPosts()`, so it preserves the source order.
 */
export function getPublishedPosts(nowMs: number = Date.now()): Post[] {
  return getAllPosts().filter((p) => postState(p, nowMs) === "published");
}

/**
 * Draft posts only, newest-first (spec 0034) - `draft: true`, regardless of any
 * `publishAt`. A subset of the preview area; distinct from scheduled posts.
 */
export function getDraftPosts(): Post[] {
  return getAllPosts().filter((p) => p.draft);
}

/**
 * Scheduled posts only, newest-first (spec 0035) - not a draft, with a
 * `publishAt` still in the future as of `nowMs`. These flip into
 * `getPublishedPosts()` once their time passes.
 */
export function getScheduledPosts(nowMs: number = Date.now()): Post[] {
  return getAllPosts().filter((p) => postState(p, nowMs) === "scheduled");
}

/**
 * The not-yet-public preview set, newest-first (spec 0035): drafts + scheduled
 * posts (everything that is not published as of `nowMs`). This is what the
 * /blog/drafts index and its per-post preview pages enumerate, so a single path
 * prefix covers both kinds. A pure derivation of `getAllPosts()`.
 */
export function getPreviewPosts(nowMs: number = Date.now()): Post[] {
  return getAllPosts().filter((p) => postState(p, nowMs) !== "published");
}

/**
 * One post by slug, including its raw MDX `content` for the page to compile.
 * Returns null if no matching file exists.
 */
export function getPostBySlug(slug: string): Post | null {
  const match = listPostFiles().find((f) => f.file.replace(/\.mdx$/, "") === slug);
  if (!match) return null;
  return readPost(match);
}

/** The chronological neighbours of a post: the older (`previous`) and newer
 *  (`next`) post, either `null` at a boundary. */
export type AdjacentPosts = { previous: Post | null; next: Post | null };

/**
 * The chronological neighbours of the post identified by `slug` (spec 0021), for
 * previous/next post navigation. Pure and non-mutating (sorts a copy newest-first
 * via `sortPostsNewestFirst`), so it is unit-tested against a multi-post fixture -
 * a single-post content dir would never exercise the ordering (learnings 0009).
 *
 * With posts ordered newest-first, the entry BEFORE the current one is the newer
 * post and the entry AFTER it is the older post, so `next` is the newer post and
 * `previous` is the older one. Either is `null` at a boundary (newest post has no
 * next, oldest has no previous), and both are `null` when `slug` is not found.
 */
export function getAdjacentPosts<T extends { slug: string; date: string }>(
  posts: T[],
  slug: string,
): { previous: T | null; next: T | null } {
  const sorted = sortPostsNewestFirst(posts);
  const i = sorted.findIndex((p) => p.slug === slug);
  if (i === -1) return { previous: null, next: null };
  return {
    // Newer post sits at the smaller index; older post at the larger index.
    next: i > 0 ? sorted[i - 1] : null,
    previous: i < sorted.length - 1 ? sorted[i + 1] : null,
  };
}
