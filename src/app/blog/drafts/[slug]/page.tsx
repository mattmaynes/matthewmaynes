import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostArticle } from "@/components/post-article";
import { type PostNavItem } from "@/components/post-nav";
import {
  getDraftPosts,
  getPostBySlug,
  getAdjacentPosts,
  readingMinutes,
} from "@/lib/blog";
import { getBlogImage } from "@/lib/blog-images";

type Params = { slug: string };

// Statically generate every DRAFT post so it is reachable by direct URL. Removing
// `draft: true` moves it to /blog/[slug] instead on the next build (spec 0034).
export function generateStaticParams(): Params[] {
  return getDraftPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  // Drafts are never indexed. A non-draft slug 404s here (it lives at /blog/<slug>).
  const robots = { index: false, follow: false };
  if (!post || !post.draft) return { title: "Blog", robots };
  return {
    title: `${post.title} - Draft`,
    description: post.excerpt,
    robots,
  };
}

export default async function DraftPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  // Only drafts live here; a published (or missing) slug 404s so each post is
  // served from exactly one route (spec 0034).
  if (!post || !post.draft) notFound();

  const minutes = readingMinutes(post);

  // Neighbours among the DRAFTS, linking back under /blog/drafts.
  const { previous, next } = getAdjacentPosts(getDraftPosts(), slug);
  const toNavItem = (p: typeof previous): PostNavItem | null =>
    p
      ? {
          slug: p.slug,
          title: p.title,
          cover: p.coverKey ? getBlogImage(p.coverKey) : undefined,
          minutes: readingMinutes(p),
          tags: p.tags,
          basePath: "/blog/drafts",
        }
      : null;

  return (
    <PostArticle
      post={post}
      previous={toNavItem(previous)}
      next={toNavItem(next)}
      minutes={minutes}
      isDraft
      basePath="/blog/drafts"
    />
  );
}
