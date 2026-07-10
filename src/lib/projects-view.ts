/**
 * Pure, fs-free view helpers for the projects grid. Split out from `projects.ts`
 * (which reads the filesystem via `getAllProjects`) so the category order, the
 * grouping, and the within-section sort are all unit-testable by `node --test`
 * without a server or a real content dir - the same split as `blog.ts` /
 * `blog-view.ts`. The Server page imports both; nothing here touches `node:fs`.
 */

// One slugifier for the whole site: re-export the blog core's so a project
// filename slug is derived exactly like a post slug (learnings 0027).
export { slugify } from "./blog-view.ts";

/**
 * The three project sections, in the fixed display order Work -> Tinkering ->
 * Making (professional-to-personal). Each `key` is the value a project's
 * `category` frontmatter must equal; each `label` is its section heading.
 */
export const CATEGORIES = [
  { key: "work", label: "Work" },
  { key: "tinkering", label: "Tinkering" },
  { key: "making", label: "Making" },
] as const;

/** A project's category: one of the three known `CATEGORIES` keys. */
export type ProjectCategory = (typeof CATEGORIES)[number]["key"];

const CATEGORY_KEYS: readonly string[] = CATEGORIES.map((c) => c.key);

/** Whether a raw frontmatter string is one of the three known categories. */
export function isProjectCategory(value: string): value is ProjectCategory {
  return CATEGORY_KEYS.includes(value);
}

/**
 * A project: its frontmatter fields plus the raw MDX body (authored now but not
 * rendered until the Phase 2 detail page). Lives in the fs-free core so both the
 * loader and the page share one shape without importing `node:fs`.
 */
export type Project = {
  slug: string;
  title: string;
  category: ProjectCategory;
  /** The card one-liner. */
  tagline: string;
  /** Cover image filename (a key into project-images.ts), if any. */
  coverKey?: string;
  /** "Before" image filename for a before/after detail stub, if any (the
   *  unlinked /projects/[slug] page reads it). */
  beforeCoverKey?: string;
  /** Free-form display badges (may be empty). */
  tags: string[];
  /** Manual sort key within a section; unset sorts to the bottom. */
  order?: number;
  /** External link; when set the whole card links out. Omitted once a Phase 2
   *  detail page exists and the card links internally instead. */
  href?: string;
  /** Reserved for Phase 2 emphasis; not used by the Phase 1 grid. */
  featured: boolean;
  /** Raw MDX body, for the Phase 2 detail page. */
  content: string;
};

/** One rendered section: its category key, heading label, and ordered projects. */
export type ProjectSection<T> = {
  key: ProjectCategory;
  label: string;
  projects: T[];
};

/**
 * Sort projects within a section by ascending `order` (lowest at the top), so a
 * section is a curated showcase rather than a date feed. A project with no
 * `order` sorts to the bottom (treated as +Infinity) rather than disappearing.
 * Ties break by title (locale-aware) for a stable, deterministic build. Pure and
 * non-mutating (sorts a copy).
 */
export function sortByOrder<T extends { order?: number; title: string }>(
  projects: T[],
): T[] {
  return [...projects].sort((a, b) => {
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return a.title.localeCompare(b.title);
  });
}

/**
 * Group projects into the fixed `CATEGORIES` order, each section's projects run
 * through `sortByOrder`. A category with no projects is dropped (so the page
 * renders no empty heading). Pure and non-mutating - unit-tested against a
 * fixture without a content dir.
 */
export function groupByCategory<
  T extends { category: ProjectCategory; order?: number; title: string },
>(projects: T[]): ProjectSection<T>[] {
  return CATEGORIES.map(({ key, label }) => ({
    key,
    label,
    projects: sortByOrder(projects.filter((p) => p.category === key)),
  })).filter((section) => section.projects.length > 0);
}
