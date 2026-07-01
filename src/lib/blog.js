/**
 * Blog content loader - the single seam every blog surface (listing, post page,
 * per-post OG route) reads. Plain JS (not TS) so the pure parsing/slug/sort
 * logic is unit-tested by `node --test` without a TS build, exactly like
 * `theme.js` and `contact.js`.
 *
 * Frontmatter is hand-parsed (no `gray-matter` dep, per the repo's no-new-dep
 * tradition): the listing reads only frontmatter, cheaply, and MDX is compiled
 * only on the post page (src/components/post-body.tsx). We only ever read our
 * own tracked files under content/blog/, never user input.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// content/blog lives at the repo root; resolve relative to process.cwd() (the
// project root at build time, where `next build` runs and enumerates posts).
const BLOG_DIR = join(process.cwd(), "content", "blog");

// Frontmatter fields that must be present, or the build fails loudly.
const REQUIRED_FIELDS = ["title", "date", "tags", "excerpt"];

/**
 * Parse a leading `---\n ... \n---` frontmatter block plus the MDX body.
 * Reads only our known keys: title, date, excerpt, cover (strings) and tags
 * (an inline array like `[Life]` or `[A, B]`). Throws if the block is missing
 * or a required field (title, date, tags, excerpt) is absent.
 *
 * @param {string} raw - the full .mdx file contents
 * @returns {{ data: { title: string, date: string, tags: string[], excerpt: string, cover?: string }, content: string }}
 */
export function parseFrontmatter(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    throw new Error("Missing frontmatter block (expected a leading '---' fence)");
  }
  const [, block, body] = match;

  /** @type {Record<string, unknown>} */
  const data = {};
  for (const line of block.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1];
    let value = kv[2].trim();

    if (key === "tags") {
      // Inline array: [Life] or [A, B]. Strip the brackets and split.
      const inner = value.replace(/^\[/, "").replace(/\]$/, "").trim();
      data.tags = inner
        ? inner.split(",").map((t) => stripQuotes(t.trim())).filter(Boolean)
        : [];
    } else if (
      ["title", "date", "excerpt", "cover", "coverCaption"].includes(key)
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

  return { data, content: body };
}

/** Strip a single pair of matching surrounding quotes, if present. */
function stripQuotes(s) {
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
 * @param {string} content - the raw MDX body (frontmatter already stripped)
 * @returns {number} whole minutes, always >= 1
 */
export function estimateReadingMinutes(content) {
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
 * @param {string} dateStr - a YYYY-MM-DD post date
 * @param {number} nowMs - the reference time in epoch ms (injected)
 * @param {number} days - the recency window, in days
 * @returns {boolean}
 */
export function isRecent(dateStr, nowMs, days) {
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
 * @template {{ slug: string, date: string }} T
 * @param {T[]} posts
 * @param {number} nowMs - the reference time in epoch ms (injected)
 * @param {number} [days=30] - the recency window, in days
 * @returns {string | null}
 */
export function newPostSlug(posts, nowMs, days = 30) {
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

/**
 * Slugify a string: lowercase, non-alphanumerics collapse to a single dash,
 * trim leading/trailing dashes. e.g. "I Picked the Wrong Elective" ->
 * "i-picked-the-wrong-elective".
 * @param {string} s
 * @returns {string}
 */
export function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Read + parse one .mdx file into a post record (frontmatter only, plus body). */
function readPost(filename) {
  const slug = filename.replace(/\.mdx$/, "");
  const raw = readFileSync(join(BLOG_DIR, filename), "utf8");
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
    excerpt: data.excerpt,
    coverKey: data.cover,
    coverCaption: data.coverCaption,
    content,
  };
}

/** List the .mdx filenames under content/blog (empty if the dir is absent). */
function listPostFiles() {
  try {
    return readdirSync(BLOG_DIR).filter((f) => f.endsWith(".mdx"));
  } catch {
    return [];
  }
}

/**
 * Sort posts newest-first by `date`. Pure and non-mutating (copies first), so
 * `node --test` can cover the ordering without touching the filesystem.
 * @template {{ date: string }} T
 * @param {T[]} posts
 * @returns {T[]}
 */
export function sortPostsNewestFirst(posts) {
  return [...posts].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * All posts, newest-first by `date`. Parses frontmatter only (does NOT compile
 * MDX), so the listing is cheap. Slug is the filename basename.
 * @returns {Array<{ slug: string, title: string, date: string, tags: string[], excerpt: string, coverKey?: string, content: string }>}
 */
export function getAllPosts() {
  return sortPostsNewestFirst(listPostFiles().map(readPost));
}

/**
 * One post by slug, including its raw MDX `content` for the page to compile.
 * Returns null if no matching file exists.
 * @param {string} slug
 */
export function getPostBySlug(slug) {
  const file = listPostFiles().find((f) => f.replace(/\.mdx$/, "") === slug);
  if (!file) return null;
  return readPost(file);
}
