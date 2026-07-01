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
    } else if (["title", "date", "excerpt", "cover"].includes(key)) {
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
  return {
    slug,
    title: data.title,
    date: data.date,
    tags: data.tags,
    excerpt: data.excerpt,
    coverKey: data.cover,
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
 * All posts, newest-first by `date`. Parses frontmatter only (does NOT compile
 * MDX), so the listing is cheap. Slug is the filename basename.
 * @returns {Array<{ slug: string, title: string, date: string, tags: string[], excerpt: string, coverKey?: string, content: string }>}
 */
export function getAllPosts() {
  return listPostFiles()
    .map(readPost)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
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
