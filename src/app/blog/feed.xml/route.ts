import { getAllPosts } from "@/lib/blog";
import { buildBlogFeed } from "@/lib/rss";
import { site } from "@/lib/site";

// Force static so the feed bakes at build like the rest of the site (no runtime
// content reads) - getAllPosts parses the tracked content/blog/*.mdx at build.
export const dynamic = "force-static";

// Served at /blog/feed.xml. The pure builder does the XML-escaping, RFC-822
// dates, and absolute-URL joining (against site.url); this handler just loads
// posts (newest-first from getAllPosts) and returns the string with the RSS
// content type.
export function GET() {
  const posts = getAllPosts();
  const xml = buildBlogFeed({
    posts,
    siteUrl: site.url,
    title: `${site.name} - Blog`,
    description: site.description,
  });
  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
