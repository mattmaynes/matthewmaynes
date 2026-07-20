import type { Metadata } from "next";
import { getPublishedPosts, newPostSlug } from "@/lib/blog";
import { toPostRows } from "@/lib/post-summaries";
import { BlogList } from "@/components/blog-list";
import { SubscribeForm } from "@/components/subscribe-form";
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

// Re-render every 60s (shared ISR window, spec 0035; see BLOG_REVALIDATE_SECONDS,
// inlined because Next requires a literal here) so a scheduled post appears on the
// listing on its own once its publishAt passes - the time-aware getPublishedPosts
// below is re-run each revalidation, with no deploy.
export const revalidate = 60;

// Reference "now" for the "New" badge, captured once when this route module is
// loaded - i.e. build/process start for this page, so "New" means "new as of
// this build/deploy" (plan 0012). Kept out of render so it stays a pure component
// (react-hooks/purity forbids Date.now() during render).
const NOW_MS = Date.now();

export default function BlogPage() {
  const posts = getPublishedPosts();

  // Resolve covers on the SERVER and compute the "New" badge once (the newest
  // post within the 30-day window), baked into the SSG HTML - shared with the
  // tag archive via `toPostRows` so both surfaces render identical rows. The
  // badge slug is derived over all published posts, so it is global (same on the
  // tag page); drafts (spec 0034) are excluded via getPublishedPosts() above.
  const newSlug = newPostSlug(posts, NOW_MS, 30);
  const listPosts = toPostRows(posts, newSlug);

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-12 sm:py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1 font-bold text-text">Blog</h1>
        <Button asChild variant="outline" aria-label="Subscribe to the blog via RSS">
          <a href="/blog/feed.xml">
            <RssIcon className="h-5 w-5" />
            RSS
          </a>
        </Button>
      </div>
      <p className="mt-3 max-w-2xl text-body text-text-muted">
        Notes on engineering, leadership, nature, and life, written down as I go.
      </p>

      {listPosts.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-body text-text-muted">No posts yet. Check back soon.</p>
        </div>
      ) : (
        <BlogList posts={listPosts} />
      )}

      <SubscribeForm source="blog_index" className="mt-16 border-t border-border pt-10" />
    </section>
  );
}
