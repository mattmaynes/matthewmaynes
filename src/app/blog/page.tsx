import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedPosts, newPostSlug } from "@/lib/blog";
import { toPostRows } from "@/lib/post-summaries";
import { BlogList } from "@/components/blog-list";
import { SubscribeForm } from "@/components/subscribe-form";
import { Button } from "@/components/ui";
import { RssButton } from "@/components/rss-button";
import { JsonLd } from "@/components/json-ld";
import { blogJsonLd } from "@/lib/structured-data";
import { blogFeedTitle } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog",
  alternates: {
    // Self-referential canonical (spec 0040): a post is reachable from /blog, its
    // tag archive, and its category archive; consolidate onto this one URL.
    canonical: "/blog",
    // Autodiscovery: emits <link rel="alternate" type="application/rss+xml"> so a
    // feed reader handed the /blog URL finds the feed automatically.
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
      {/* Blog structured data (spec 0040): names the blog + attributes it to the
          site Person, tying the posts to a named collection and author. */}
      <JsonLd data={blogJsonLd()} />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1 font-bold text-text">Blog</h1>
        {/* The two follow affordances, grouped so they wrap as a unit under the
            heading rather than splitting across lines (spec 0041). Email leads as
            the primary fill; RSS stays the outline secondary it already was, so the
            two no longer read as co-equal asks. */}
        <div className="flex items-center gap-2">
          {/* aria-label, not the bare visible text: the adjacent RSS button's name
              also begins "Subscribe to the blog", so spell out which channel this
              is. "Subscribe" is a prefix of the full name, so WCAG 2.5.3 (Label in
              Name) still holds - and this string is grep-unique, which is what the
              smoke test guards on (href="/subscribe" is emitted by the footer on
              every page, so it could never fail). */}
          {/* ?from=blog_header is attribution, not routing. /subscribe hard-codes
              source="subscribe_page", so without it a conversion driven by this CTA
              is indistinguishable from a footer-link, /links, shared-URL, or direct
              visit - and this CTA would silently inflate that bucket. Autocapture is
              no fallback: the footer emits an <a> with the same text and href on
              every page. posthog-js stamps $current_url on every event and the form
              submits in place via fetch, so the existing blog_subscribe_* events
              carry the param with no new event and no client component. The page
              never reads searchParams and its canonical is pinned, so ISR and SEO
              are unaffected. */}
          <Button asChild aria-label="Subscribe to the blog by email">
            <Link href="/subscribe?from=blog_header">Subscribe</Link>
          </Button>
          <RssButton />
        </div>
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
