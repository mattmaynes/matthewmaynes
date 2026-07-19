import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostArticle } from "@/components/post-article";
import { type PostNavItem } from "@/components/post-nav";
import {
  getPublishedPosts,
  getPostBySlug,
  getAdjacentPosts,
  isPublishedNow,
  readingMinutes,
} from "@/lib/blog";
import { getBlogImage } from "@/lib/blog-images";
import { blogFeedTitle } from "@/lib/site";

type Params = { slug: string };

// Re-check the clock every 60s (the shared ISR window, spec 0035; see
// BLOG_REVALIDATE_SECONDS - inlined as a literal because Next requires route
// segment config to be statically analyzable): a post scheduled for a future
// `publishAt` is not baked into generateStaticParams, so it 404s here until its
// time; ISR revalidation refreshes that 404 into the real page once it is due,
// with no deploy.
export const revalidate = 60;

// Statically generate every PUBLISHED post at build time (no runtime fetching).
// Drafts and not-yet-due scheduled posts are served from /blog/drafts/[slug]
// instead (spec 0034/0035); a scheduled post renders on-demand here once its
// time passes (dynamicParams defaults to true).
export function generateStaticParams(): Params[] {
  return getPublishedPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  // A missing post, a draft, or a not-yet-due scheduled post (all of which live
  // under /blog/drafts) is not a published post at this URL - the page 404s, so
  // keep the metadata minimal (spec 0034/0035).
  if (!post || !isPublishedNow(post)) return { title: "Blog" };
  // The per-post opengraph-image.tsx in this route segment supplies the og:image
  // automatically; we set the shareable title/description here.
  return {
    title: `${post.title} - Blog`,
    description: post.excerpt,
    // Autodiscovery: advertise the blog feed from each post's <head> too, so a
    // reader handed a post URL can still find the feed.
    alternates: {
      types: {
        "application/rss+xml": [
          { url: "/blog/feed.xml", title: blogFeedTitle },
        ],
      },
    },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  // A draft or a not-yet-due scheduled post is reachable only at
  // /blog/drafts/<slug>; 404 it here so a slug is served from exactly one route
  // at any instant (spec 0034/0035). A scheduled post flips to a 200 here once
  // its publishAt passes (via ISR revalidation).
  if (!post || !isPublishedNow(post)) notFound();

  const minutes = readingMinutes(post);

  // Chronological neighbours for the previous/next nav (spec 0021), among the
  // PUBLISHED posts so nav never lands on a hidden draft. Resolve their covers on
  // the server so each tile carries its blurDataURL, like the listing.
  const { previous, next } = getAdjacentPosts(getPublishedPosts(), slug);
  const toNavItem = (p: typeof previous): PostNavItem | null =>
    p
      ? {
          slug: p.slug,
          title: p.title,
          cover: p.coverKey ? getBlogImage(p.coverKey) : undefined,
          // Reading time + tags for the tile badges (spec 0023).
          minutes: readingMinutes(p),
          tags: p.tags,
        }
      : null;

  return (
    <PostArticle
      post={post}
      previous={toNavItem(previous)}
      next={toNavItem(next)}
      minutes={minutes}
    />
  );
}
