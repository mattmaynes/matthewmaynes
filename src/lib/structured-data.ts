/**
 * Pure, fs-free JSON-LD builders for the site's structured data (spec 0040).
 * Split out from the pages/layout - like `rss.ts` - so the schema shapes run
 * under `node --test` without booting a server or importing React: every builder
 * returns a plain object, and every URL is joined against `site.url` so it is
 * absolute regardless of the calling surface.
 *
 * One source of truth: the facts come from `site` / `identity` / `resume`, not
 * hardcoded strings, so the machine-readable identity can never drift from the
 * human-facing constants. `worksFor` reads `resume.work[0].company` (the current
 * role) rather than a new constant, so there is no second place to update and no
 * new field on the hash-gated `identity.ts`.
 *
 * No fs, no React: unit-testable in isolation.
 */

// Import the ASSET-FREE modules (identity / site-text / resume) rather than
// site.ts: site.ts static-imports the staged .jpg/.png images, which Node's test
// runner cannot load, so importing it would make this module un-unit-testable.
// These carry the same single-source values (site.ts re-exports them).
import { identity } from "./identity.ts";
import { description, headshotPath } from "./site-text.ts";
import { resume } from "./resume.ts";
import type { Post } from "./blog.ts";

// The blog title mirrors blogFeedTitle in site.ts (name + " - Blog"); derived
// from identity so the two never drift without importing the image-laden site.ts.
const blogTitle = `${identity.name} - Blog`;

/** A JSON-LD object: `@context` / `@type` plus arbitrary schema.org fields. */
export type JsonLdObject = Record<string, unknown>;

/** Join a path against the canonical site origin so JSON-LD URLs are absolute
 *  (crawlers need absolute URLs). `new URL` normalizes a trailing slash on the
 *  origin, so a bare path or a full URL both resolve cleanly. */
export function absoluteUrl(path: string): string {
  return new URL(path, identity.url).toString();
}

/** The areas of expertise advertised to answer engines (`knowsAbout`). A small,
 *  curated slice of the public resume skills - not PII, and the same facts the
 *  /resume page already renders. */
const KNOWS_ABOUT: readonly string[] = resume.skills;

/**
 * The site-wide `Person` node (moved out of `layout.tsx`, spec 0040), enriched
 * with `worksFor` (current employer from the resume), `description`, and
 * `knowsAbout`. Keeps the original `jobTitle`, `image`, and `sameAs`.
 */
export function personJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: identity.name,
    url: identity.url,
    jobTitle: identity.title,
    description,
    image: absoluteUrl(headshotPath),
    worksFor: {
      "@type": "Organization",
      name: resume.work[0].company,
    },
    knowsAbout: [...KNOWS_ABOUT],
    sameAs: [identity.social.linkedin, identity.social.github, identity.social.x],
  };
}

/** A compact reference to the site `Person`, for the `author` / `publisher` of
 *  the WebSite / Blog / BlogPosting nodes. Inline (name + url) rather than an
 *  `@id` graph so each node is self-contained and independently valid. */
function personRef(): JsonLdObject {
  return {
    "@type": "Person",
    name: identity.name,
    url: identity.url,
  };
}

/**
 * The homepage `WebSite` node (spec 0040): ties the site to a named author /
 * publisher so an engine can attribute the pages and posts to Matthew.
 */
export function websiteJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: identity.url,
    name: `${identity.name} - ${identity.title}`,
    description,
    author: personRef(),
    publisher: personRef(),
  };
}

/**
 * The `/blog` `Blog` node (spec 0040): names the blog and attributes it to the
 * site `Person`, so an engine can tie the posts to a named collection + author.
 */
export function blogJsonLd(): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    url: absoluteUrl("/blog"),
    name: blogTitle,
    description,
    author: personRef(),
    publisher: personRef(),
  };
}

/** Count the words in an MDX body for `wordCount`. Pure and deterministic:
 *  strips the same non-prose markup `estimateReadingMinutes` does (fenced code,
 *  inline code, JSX/HTML tags, markdown link URLs, emphasis markers) then counts
 *  whitespace-separated tokens - so the count reflects the prose a reader sees,
 *  not the raw markup. */
export function countWords(content: string): number {
  const prose = String(content ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~`|-]+/g, " ");
  return prose.split(/\s+/).filter(Boolean).length;
}

/** A YYYY-MM-DD post date as an ISO 8601 date-time at UTC midnight (e.g.
 *  "2026-06-28" -> "2026-06-28T00:00:00.000Z"), matching how the rest of the
 *  blog parses post dates (UTC midnight, no locale drift). */
export function toIsoDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`toIsoDate: unparseable date "${dateStr}"`);
  }
  return d.toISOString();
}

/**
 * The `BlogPosting` node for a single published post (spec 0040). Emitted ONLY
 * on the published post route, behind the same `isPublishedNow` guard the page
 * and OG route use, so nothing leaks before `publishAt`. `image` is the post's
 * per-post OG card (always present, unlike an optional cover). `wordCount` is the
 * prose count; `keywords` are the tags; `articleSection` is the category.
 */
export function blogPostingJsonLd(
  post: Post,
  { minutes }: { minutes?: number } = {},
): JsonLdObject {
  const url = absoluteUrl(`/blog/${post.slug}`);
  const iso = toIsoDate(post.date);
  const node: JsonLdObject = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    url,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    datePublished: iso,
    dateModified: iso,
    author: personRef(),
    publisher: personRef(),
    image: absoluteUrl(`/blog/${post.slug}/opengraph-image`),
    keywords: post.tags.join(", "),
    articleSection: post.category,
    wordCount: countWords(post.content),
  };
  if (typeof minutes === "number") {
    // ISO 8601 duration (e.g. "PT5M") so an engine can surface the read time.
    node.timeRequired = `PT${minutes}M`;
  }
  return node;
}

/** One crumb in a breadcrumb trail: a visible `name` and the URL it points at.
 *  The last crumb (the current page) may omit `url` - schema.org allows a
 *  terminal `ListItem` with just a name. */
export type BreadcrumbItem = { name: string; url?: string };

/**
 * A `BreadcrumbList` node from an ordered list of crumbs (spec 0040). Each crumb
 * becomes a `ListItem` with a 1-based `position`; a crumb's `url` is made
 * absolute. The trailing current-page crumb can carry just a name.
 */
export function breadcrumbListJsonLd(items: BreadcrumbItem[]): JsonLdObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => {
      const el: JsonLdObject = {
        "@type": "ListItem",
        position: i + 1,
        name: item.name,
      };
      if (item.url) el.item = absoluteUrl(item.url);
      return el;
    }),
  };
}
