import type { MetadataRoute } from "next";
import { nav, site } from "@/lib/site";
import { getPublishedPosts } from "@/lib/blog";
import {
  deriveTags,
  tagSlug,
  deriveCategories,
  categorySlug,
} from "@/lib/blog-view";

// Re-generate every 60s (shared ISR window, spec 0035) so a scheduled post enters
// the sitemap on its own once its publishAt passes, with no deploy.
export const revalidate = 60;

// Routes that are not in the top nav but should still be crawlable/shareable.
// `/subscribe` (spec 0020) is a focused landing page meant to be handed out, so it
// belongs in the sitemap even though it is deliberately kept out of `nav`. (An
// in-progress stub like `/projects` or a footer utility like `/privacy` stays out
// of both by simply not appearing here.)
const EXTRA_ROUTES: readonly string[] = ["/subscribe", "/links"];

type SitemapEntry = MetadataRoute.Sitemap[number];

// Served at /sitemap.xml. Nav routes come from the same `nav` the header renders,
// so a nav page is listed the moment it joins the nav - one source, no drift - plus
// the explicit EXTRA_ROUTES above. Blog posts and per-tag archives (spec 0027) are
// enumerated from the content so every post and tag page is crawlable (previously
// only nav routes were listed - individual posts were absent).
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  // Published posts only - drafts are deliberately absent from the sitemap (spec 0034).
  const posts = getPublishedPosts();

  const staticEntries: SitemapEntry[] = [
    ...nav.map((item) => item.href),
    ...EXTRA_ROUTES,
  ].map((href) => ({
    url: new URL(href, site.url).toString(),
    lastModified,
    changeFrequency: "monthly",
    priority: href === "/" ? 1 : 0.7,
  }));

  // Each post, dated by its own publish date so crawlers get a real lastmod.
  const postEntries: SitemapEntry[] = posts.map((post) => ({
    url: new URL(`/blog/${post.slug}`, site.url).toString(),
    lastModified: new Date(`${post.date}T00:00:00Z`),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  // One archive per tag (spec 0027); its content shifts as posts are tagged, so
  // a slightly higher change frequency than a single post.
  const tagEntries: SitemapEntry[] = deriveTags(posts).map((tag) => ({
    url: new URL(`/blog/tags/${tagSlug(tag)}`, site.url).toString(),
    lastModified,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  // One archive per category with posts (spec 0038); like tag archives, its
  // content shifts as posts are categorized, so a weekly change frequency.
  const categoryEntries: SitemapEntry[] = deriveCategories(posts).map(
    (category) => ({
      url: new URL(`/blog/categories/${categorySlug(category)}`, site.url).toString(),
      lastModified,
      changeFrequency: "weekly",
      priority: 0.5,
    }),
  );

  return [...staticEntries, ...postEntries, ...tagEntries, ...categoryEntries];
}
