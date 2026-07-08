/**
 * Server-only mapping from parsed posts to the serializable `PostRowData` the
 * listing island and the tag archive both render. Resolves each cover on the
 * SERVER (via `getBlogImage`, a static import carrying its blurDataURL) and
 * computes the "New" badge once, so neither surface imports `blog-images.ts`
 * across a client boundary (learnings 0005) and no `Date.now()` runs during
 * render - the caller injects `nowMs` from a module-scope const (learnings 0012).
 */
import { newPostSlug, readingMinutes, type Post } from "@/lib/blog";
import { getBlogImage } from "@/lib/blog-images";
import type { PostRowData } from "@/components/post-row";

/**
 * Map posts (already newest-first) to row summaries. The globally-newest post
 * within the recency window carries the "New" badge - the same badge on the
 * listing and on a tag page, so a fresh post reads as new wherever it appears.
 *
 * @param posts - posts to render, newest-first
 * @param nowMs - reference time for the "New" badge (injected; module-scope const)
 */
export function toPostRows(posts: Post[], nowMs: number): PostRowData[] {
  const newSlug = newPostSlug(posts, nowMs, 30);
  return posts.map((post) => {
    const cover = post.coverKey ? getBlogImage(post.coverKey) : undefined;
    return {
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      date: post.date,
      tags: post.tags,
      cover: cover ? { ...cover, alt: cover.alt } : undefined,
      pixelated: cover?.pixelated === true,
      isNew: post.slug === newSlug,
      minutes: readingMinutes(post),
    };
  });
}
