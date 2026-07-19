import { getPublishedPosts } from "@/lib/blog";
import { buildBlogFeed } from "@/lib/rss";
import { site, blogFeedTitle } from "@/lib/site";

// Re-bake every 60s (shared ISR window, spec 0035) instead of a one-time build
// (force-static): the whole site is otherwise static, so a scheduled post would
// never enter the feed until a deploy. Revalidation re-runs the time-aware
// getPublishedPosts, so the post enters the feed on its own at its publishAt (and
// never before it).
export const revalidate = 60;

// Served at /blog/feed.xml. The pure builder does the XML-escaping, RFC-822
// dates, and absolute-URL joining (against site.url); this handler just loads
// posts (newest-first from getAllPosts) and returns the string with the RSS
// content type.
export function GET() {
  const posts = getPublishedPosts();
  const xml = buildBlogFeed({
    posts,
    siteUrl: site.url,
    title: blogFeedTitle,
    description: site.description,
  });
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
