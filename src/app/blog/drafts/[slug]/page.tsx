import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostArticle } from "@/components/post-article";
import { type PostNavItem } from "@/components/post-nav";
import {
  getPreviewPosts,
  getPostBySlug,
  getAdjacentPosts,
  isPreviewNow,
  readingMinutes,
} from "@/lib/blog";
import { getBlogImage } from "@/lib/blog-images";

type Params = { slug: string };

// Re-check the clock every 60s (shared ISR window, spec 0035): a scheduled post
// leaves this preview route on its own once its publishAt passes (it moves to
// /blog/<slug>), so a stale preview does not linger after it publishes.
export const revalidate = 60;

// Statically generate every preview post (drafts + scheduled) so each is
// reachable by direct URL. Publishing a draft (remove `draft: true`) or a
// scheduled post (its publishAt passes) moves it to /blog/[slug] instead
// (spec 0034/0035).
export function generateStaticParams(): Params[] {
  return getPreviewPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  // Previews are never indexed. A published slug 404s here (it lives at /blog/<slug>).
  const robots = { index: false, follow: false };
  if (!post || !isPreviewNow(post)) return { title: "Blog", robots };
  // Still emit a real share card so the preview can be link-preview tested: the
  // co-located opengraph-image route supplies og:image automatically; noindex
  // keeps it out of search, not out of an unfurl.
  return {
    title: `${post.title} - ${post.draft ? "Draft" : "Scheduled"}`,
    description: post.excerpt,
    robots,
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

export default async function DraftPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  // Only previews (drafts + not-yet-due scheduled posts) live here; a published
  // (or missing) slug 404s so each post is served from exactly one route at any
  // instant (spec 0034/0035).
  if (!post || !isPreviewNow(post)) notFound();

  const minutes = readingMinutes(post);

  // Neighbours among the PREVIEW posts, linking back under /blog/drafts.
  const { previous, next } = getAdjacentPosts(getPreviewPosts(), slug);
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
      variant={post.draft ? "draft" : "scheduled"}
    />
  );
}
