/**
 * Pure, fs-free builder for `/llms.txt` (spec 0040): the plain-markdown briefing
 * an AI crawler reads to learn who this is, the primary pages, and every
 * published blog post - the emerging llms.txt convention. Split out from the
 * route (like `rss.ts`) so the markdown assembly and absolute-URL joining run
 * under `node --test` without a server.
 *
 * Deterministic by design: no `Date.now()`, no host locale - the output is a
 * pure function of `{ site, nav, posts }`, so it is byte-stable and fully
 * unit-testable. The route feeds it the time-aware `getPublishedPosts()`, so a
 * scheduled post enters the file on its own at its `publishAt` (and never before).
 */

/** A post as `llms.txt` needs it: enough to render a titled, dated link + blurb. */
export type LlmsPost = {
  slug: string;
  title: string;
  date: string;
  excerpt: string;
};

/** The site facts the briefing renders (a subset of the `site` object). */
export type LlmsSite = {
  name: string;
  title: string;
  tagline: string;
  description: string;
  url: string;
};

/** A nav entry: the path and its human label. */
export type LlmsNavItem = { href: string; label: string };

/**
 * Build the `/llms.txt` markdown. Layout (llms.txt convention): an `# {name}` H1,
 * a one-paragraph intro (tagline + description), a `## Pages` list of the nav
 * routes with absolute URLs, a `## Writing` list of every published post
 * (`- [title](url) - YYYY-MM-DD - excerpt`), and a `## More` section pointing at
 * the RSS feed and the AI-policy page. Every URL is absolute (joined against
 * `site.url`), and posts render in the order given (newest-first from
 * `getPublishedPosts`).
 */
export function buildLlmsTxt({
  site,
  nav,
  posts,
}: {
  site: LlmsSite;
  nav: readonly LlmsNavItem[];
  posts: LlmsPost[];
}): string {
  const abs = (path: string) => new URL(path, site.url).toString();

  const lines: string[] = [];

  // H1 + one-paragraph intro: who this is, in the crawler's own words.
  lines.push(`# ${site.name} - ${site.title}`);
  lines.push("");
  lines.push(`> ${site.tagline}.`);
  lines.push("");
  lines.push(site.description);
  lines.push("");

  // Pages: the primary routes from the shared nav, as absolute URLs.
  lines.push("## Pages");
  lines.push("");
  for (const item of nav) {
    lines.push(`- [${item.label}](${abs(item.href)})`);
  }
  lines.push("");

  // Writing: every published post, titled + dated + one-line excerpt.
  lines.push("## Writing");
  lines.push("");
  if (posts.length === 0) {
    lines.push("No posts published yet.");
  } else {
    for (const post of posts) {
      lines.push(
        `- [${post.title}](${abs(`/blog/${post.slug}`)}) - ${post.date} - ${post.excerpt}`,
      );
    }
  }
  lines.push("");

  // Usage: the content licensing line (spec 0042). This file exists to invite
  // answer engines (spec 0040), so a blanket "do not use" would contradict its
  // own purpose - and silence states nothing at all. It draws the split the
  // author actually wants: the TEXT is quotable with attribution, the images and
  // video are not reusable and not training data. Advisory, like the rest of
  // llms.txt; /terms is the authoritative statement.
  lines.push("## Usage");
  lines.push("");
  lines.push(
    `The text on this site may be read, quoted, and cited with attribution and a link to the original page. ` +
      `The images and video may not be reproduced, redistributed, or used as training data, in whole or in part - ` +
      `they include photographs of the author's family. Full terms: ${abs("/terms")}`,
  );
  lines.push("");

  // More: the machine-readable feed + the AI-usage policy.
  lines.push("## More");
  lines.push("");
  lines.push(`- [RSS feed](${abs("/blog/feed.xml")})`);
  lines.push(`- [AI policy](${abs("/ai-policy")})`);
  lines.push("");

  return lines.join("\n");
}
