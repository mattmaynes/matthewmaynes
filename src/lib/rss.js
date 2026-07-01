/**
 * Pure, fs-free RSS 2.0 feed builder for the blog. Split out from the route
 * handler (like `blog-view.js`) so the XML-escaping and date formatting run
 * under `node --test` without booting a server. The route is a thin shell that
 * loads posts and returns this module's string with the right headers.
 *
 * Deterministic by design: `lastBuildDate` is the newest post's date (not
 * `Date.now()`), so the feed is a pure function of the content and fully
 * unit-testable.
 *
 * @typedef {{ slug: string, title: string, date: string, excerpt: string }} FeedPost
 */

// Fixed day/month name tables so RFC-822 dates never depend on the host locale
// (unlike toLocaleDateString), keeping the feed byte-identical across machines.
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Escape the five XML metacharacters so any interpolated title/excerpt is safe
 * inside element text or attributes. Ampersand is replaced FIRST, otherwise the
 * `&` in the other entities (`&lt;` etc.) would be double-escaped.
 * @param {string} str
 * @returns {string}
 */
export function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Format a YYYY-MM-DD date as an RFC-822 date-time, e.g. "2026-06-28" ->
 * "Sun, 28 Jun 2026 00:00:00 GMT". Parsed as UTC midnight (like
 * `formatPostDate`) and built from the fixed name tables above, so there is no
 * locale or timezone dependence.
 * @param {string} dateStr
 * @returns {string}
 */
export function toRfc822(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  // Fail loudly on a malformed date rather than emitting an invalid
  // "NaN undefined NaN" pubDate that feed readers reject (a typo'd frontmatter
  // date should break the build, like blog.js's required-field check).
  if (Number.isNaN(d.getTime())) {
    throw new Error(`toRfc822: unparseable date "${dateStr}"`);
  }
  const day = DAYS[d.getUTCDay()];
  const date = String(d.getUTCDate()).padStart(2, "0");
  const month = MONTHS[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${day}, ${date} ${month} ${year} 00:00:00 GMT`;
}

/**
 * Build a valid RSS 2.0 XML string for the blog. Posts arrive newest-first
 * (as `getAllPosts` returns them); item order is preserved. Every item link and
 * guid is absolute (joined against `siteUrl`), and every interpolated title and
 * excerpt is XML-escaped. `lastBuildDate` is the newest post's RFC-822 date for
 * deterministic output; an empty feed omits it.
 *
 * @param {{ posts: FeedPost[], siteUrl: string, title: string, description: string }} args
 * @returns {string}
 */
export function buildBlogFeed({ posts, siteUrl, title, description }) {
  // Join paths against the site origin so links are absolute (feed readers need
  // absolute URLs). `new URL` normalizes a trailing slash on siteUrl.
  const abs = (path) => new URL(path, siteUrl).toString();
  const blogUrl = abs("/blog");
  const feedUrl = abs("/blog/feed.xml");

  const items = posts
    .map((post) => {
      const link = abs(`/blog/${post.slug}`);
      return [
        "    <item>",
        `      <title>${escapeXml(post.title)}</title>`,
        `      <link>${escapeXml(link)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(link)}</guid>`,
        `      <pubDate>${toRfc822(post.date)}</pubDate>`,
        `      <description>${escapeXml(post.excerpt)}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const lastBuild = posts.length
    ? `\n    <lastBuildDate>${toRfc822(posts[0].date)}</lastBuildDate>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(blogUrl)}</link>
    <description>${escapeXml(description)}</description>
    <language>en-ca</language>
    <atom:link rel="self" type="application/rss+xml" href="${escapeXml(feedUrl)}"/>${lastBuild}
${items}
  </channel>
</rss>
`;
}
