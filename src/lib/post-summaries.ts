/**
 * Server-only mapping from parsed posts to the serializable `PostRowData` the
 * listing island and the tag archive both render. Resolves each cover on the
 * SERVER (via `getBlogImage`, a static import carrying its blurDataURL) so
 * neither surface imports `blog-images.ts` across a client boundary
 * (learnings 0005).
 */
import { readingMinutes, type Post } from "@/lib/blog";
import { getBlogImage } from "@/lib/blog-images";
import type { PostRowData } from "@/lib/blog-view";

/**
 * Map posts to row summaries, tagging the one post whose slug is `newSlug` as
 * "New". `newSlug` is computed by the caller over the FULL post set (not a
 * per-tag subset), so the badge is global: a post reads "New" on the listing
 * and on its tag page identically, or on neither - never tag-locally (review of
 * PR #91). Pass `newSlug = null` to badge nothing.
 *
 * @param posts - the posts to render (any subset), already newest-first
 * @param newSlug - the globally-newest recent post's slug, or null
 * @param basePath - the URL base each row links under ("/blog" by default, or
 *   "/blog/drafts" for the drafts index, spec 0034)
 */
export function toPostRows(
  posts: Post[],
  newSlug: string | null,
  basePath = "/blog",
): PostRowData[] {
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
      basePath,
    };
  });
}
