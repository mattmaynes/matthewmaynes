import type { Metadata } from "next";
import { getAllPosts, newPostSlug, readingMinutes } from "@/lib/blog";
import { getBlogImage } from "@/lib/blog-images";
import { BlogList, type BlogListPost } from "@/components/blog-list";
import { Button } from "@/components/ui";
import { RssIcon } from "@/components/blog-icons";
import { blogFeedTitle } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog",
  // Autodiscovery: emits <link rel="alternate" type="application/rss+xml"> so a
  // feed reader handed the /blog URL finds the feed automatically.
  alternates: {
    types: {
      "application/rss+xml": [
        { url: "/blog/feed.xml", title: blogFeedTitle },
      ],
    },
  },
};

// Reference "now" for the "New" badge, captured once when this route module is
// loaded - i.e. at build time for this statically generated page, so "New" means
// "new as of this build/deploy" (plan 0012). Kept out of render so it stays a
// pure component (react-hooks/purity forbids Date.now() during render).
const NOW_MS = Date.now();

export default function BlogPage() {
  const posts = getAllPosts();

  // Which post carries the "New" badge, computed once on the server: the newest
  // post while it is still within the 30-day recency window. Baked into the SSG
  // HTML (no Date.now() on the client), so there is no hydration mismatch.
  const newSlug = newPostSlug(posts, NOW_MS, 30);

  // Resolve each cover on the SERVER and pass the static import (which carries
  // its blurDataURL) plus the pixelated flag down, so next/image in the client
  // island keeps placeholder="blur" / pixelated behaviour without importing
  // blog-images.ts across the boundary (learnings 0005).
  const listPosts: BlogListPost[] = posts.map((post) => {
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

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-12 sm:py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1 font-bold text-text">Blog</h1>
        <Button asChild variant="ghost" aria-label="Subscribe to the blog via RSS">
          <a href="/blog/feed.xml">
            <RssIcon className="h-5 w-5" />
            RSS
          </a>
        </Button>
      </div>
      <p className="mt-3 max-w-2xl text-body text-text-muted">
        Notes on engineering, leadership, nature, and life - written down as I go.
      </p>

      {listPosts.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-body text-text-muted">No posts yet. Check back soon.</p>
        </div>
      ) : (
        <BlogList posts={listPosts} />
      )}
    </section>
  );
}
