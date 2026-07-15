import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostArticle } from "@/components/post-article";
import { type PostNavItem } from "@/components/post-nav";
import {
  getPublishedPosts,
  getPostBySlug,
  getAdjacentPosts,
  readingMinutes,
} from "@/lib/blog";
import { getBlogImage } from "@/lib/blog-images";
import { blogFeedTitle } from "@/lib/site";

type Params = { slug: string };

// Statically generate every PUBLISHED post at build time (no runtime fetching).
// Drafts are served from /blog/drafts/[slug] instead (spec 0034).
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
  // A missing post or a draft (which lives under /blog/drafts) is not a published
  // post at this URL - the page 404s, so keep the metadata minimal.
  if (!post || post.draft) return { title: "Blog" };
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
  // A draft is reachable only at /blog/drafts/<slug>; 404 it here so a slug is
  // served from exactly one route (spec 0034).
  if (!post || post.draft) notFound();

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
