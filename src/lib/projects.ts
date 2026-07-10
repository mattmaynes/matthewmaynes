/**
 * Projects content loader - the seam the projects grid reads. Mirrors
 * src/lib/blog.ts: frontmatter is hand-parsed (no `gray-matter` dep), we only
 * ever read our own tracked files under content/projects/, and the pure parsing
 * lives here so `node --test` (tests/projects.test.ts) can cover it directly -
 * Node strips the types at load, so there is no separate build step.
 *
 * The listing reads frontmatter only; the MDX body is carried through for the
 * Phase 2 detail page but is not compiled here.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  isProjectCategory,
  slugify,
  type Project,
  type ProjectCategory,
} from "./projects-view.ts";

// content/projects lives at the repo root; resolve relative to process.cwd()
// (the project root at build time, where `next build` enumerates the files).
const PROJECTS_DIR = join(process.cwd(), "content", "projects");

// Frontmatter fields that must be present, or the build fails loudly.
const REQUIRED_FIELDS = ["title", "category", "tagline"] as const;

/** The parsed frontmatter block: the known keys we read off each project. */
export type ProjectFrontmatter = {
  title: string;
  category: ProjectCategory;
  tagline: string;
  cover?: string;
  beforeCover?: string;
  tags: string[];
  order?: number;
  href?: string;
  featured: boolean;
};

/** Strip a single pair of matching surrounding quotes, if present. */
function stripQuotes(s: string): string {
  return s.replace(/^["'](.*)["']$/, "$1");
}

/**
 * Parse a leading `---\n ... \n---` frontmatter block plus the MDX body. Reads
 * only our known keys: title, category, tagline, cover, href (strings), tags (an
 * inline array like `[React, AI]`), order (a number), and featured (a boolean).
 * Throws if the block is missing, a required field (title, category, tagline) is
 * absent, or the category is not one of the three known values.
 *
 * @param raw - the full .mdx file contents
 */
export function parseProjectFrontmatter(raw: string): {
  data: ProjectFrontmatter;
  content: string;
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    throw new Error("Missing frontmatter block (expected a leading '---' fence)");
  }
  const [, block, body] = match;

  const data: Record<string, unknown> = { tags: [], featured: false };
  for (const line of block.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const kv = /^([A-Za-z][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1];
    const value = kv[2].trim();

    if (key === "tags") {
      // Inline array: [React] or [A, B]. Strip the brackets and split.
      const inner = value.replace(/^\[/, "").replace(/\]$/, "").trim();
      data.tags = inner
        ? inner.split(",").map((t) => stripQuotes(t.trim())).filter(Boolean)
        : [];
    } else if (key === "order") {
      const n = Number(stripQuotes(value));
      if (Number.isFinite(n)) data.order = n;
    } else if (key === "featured") {
      data.featured = /^true$/i.test(stripQuotes(value));
    } else if (
      ["title", "category", "tagline", "cover", "beforeCover", "href"].includes(key)
    ) {
      data[key] = stripQuotes(value);
    }
  }

  for (const field of REQUIRED_FIELDS) {
    const v = data[field];
    if (v === undefined || v === "" || (typeof v === "string" && !v.trim())) {
      throw new Error(`Frontmatter is missing required field: ${field}`);
    }
  }
  if (!isProjectCategory(String(data.category))) {
    throw new Error(
      `Unknown project category "${data.category}" (expected one of: work, tinkering, making)`,
    );
  }

  return { data: data as unknown as ProjectFrontmatter, content: body };
}

/** Read + parse one .mdx file into a project record. */
function readProject(filename: string): Project {
  const slug = filename.replace(/\.mdx$/, "");
  const raw = readFileSync(join(PROJECTS_DIR, filename), "utf8");
  const { data, content } = parseProjectFrontmatter(raw);
  // The slug is the filename; enforce that it matches the slugified title so a
  // filename/title drift fails the build loudly (the same rule as content/blog).
  const expected = slugify(data.title);
  if (slug !== expected) {
    throw new Error(
      `Project filename slug "${slug}" does not match its title "${data.title}" (rename to "${expected}.mdx")`,
    );
  }
  return {
    slug,
    title: data.title,
    category: data.category,
    tagline: data.tagline,
    coverKey: data.cover,
    beforeCoverKey: data.beforeCover,
    tags: data.tags,
    order: data.order,
    href: data.href,
    featured: data.featured,
    content,
  };
}

/** List the .mdx filenames under content/projects (empty if the dir is absent). */
function listProjectFiles(): string[] {
  try {
    return readdirSync(PROJECTS_DIR).filter((f) => f.endsWith(".mdx"));
  } catch {
    return [];
  }
}

/**
 * All projects (frontmatter only; the MDX body is not compiled). Unordered here
 * - the page groups and sorts them via `groupByCategory` in the fs-free view
 * core. Reads only tracked files under content/projects.
 */
export function getAllProjects(): Project[] {
  return listProjectFiles().map(readProject);
}
