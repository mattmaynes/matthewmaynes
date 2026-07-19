import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedPosts, newPostSlug } from "@/lib/blog";
import { deriveTags, tagSlug, tagFromSlug, filterPosts } from "@/lib/blog-view";
import { toPostRows } from "@/lib/post-summaries";
import { PostRow } from "@/components/post-row";
import { SubscribeForm } from "@/components/subscribe-form";
import { FOCUS_RING as RING } from "@/lib/focus-ring";

type Params = { tag: string };

// Reference "now" for the "New" badge, captured once at module load - i.e. at
// build/process start for these pages (learnings 0012, mirrors the listing).
// Kept out of render so the component stays pure.
const NOW_MS = Date.now();

// Re-render every 60s (shared ISR window, spec 0035) so a scheduled post joins its
// tag archive on its own once its publishAt passes, with no deploy. NOTE: the set
// of tag PAGES is still baked at build (dynamicParams=false below), so a brand-new
// tag introduced ONLY by a scheduled post gets its page on the next build; a tag
// it shares with a published post already has a page that fills in on revalidation.
export const revalidate = 60;

// Every tag gets a page, baked at build; an unknown slug is a 404, never a
// render (dynamicParams=false), so /blog/tags/<garbage> is a clean not-found.
export const dynamicParams = false;

// One page per tag across all posts (including single-post tags). A future tag
// yields a page on the next build with no config change - the params derive
// from the posts.
export function generateStaticParams(): Params[] {
  return deriveTags(getPublishedPosts()).map((tag) => ({ tag: tagSlug(tag) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { tag: slug } = await params;
  const posts = getPublishedPosts();
  const tag = tagFromSlug(slug, deriveTags(posts));
  if (!tag) return { title: "Blog" };
  const count = filterPosts(posts, tag, "").length;
  const plural = count === 1 ? "post" : "posts";
  return {
    // Layout appends " - Matthew Maynes"; this is the route-unique title.
    title: `Posts tagged "${tag}" - Blog`,
    description: `${count} ${plural} tagged "${tag}" on the Matthew Maynes blog - notes on engineering, leadership, nature, and life.`,
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { tag: slug } = await params;
  const posts = getPublishedPosts();
  const tag = tagFromSlug(slug, deriveTags(posts));
  if (!tag) notFound();

  // Posts carrying this tag, already newest-first from getAllPosts. The "New"
  // badge slug is derived over ALL posts (not this tag's subset), so it is the
  // same global badge shown on /blog - a post is never "New" only tag-locally.
  const rows = toPostRows(filterPosts(posts, tag, ""), newPostSlug(posts, NOW_MS, 30));

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-12 sm:py-16">
      <Link
        href="/blog"
        className={`inline-block rounded-sm text-caption text-text-subtle hover:text-primary ${RING}`}
      >
        &larr; All posts
      </Link>
      <h1 className="mt-3 text-h1 font-bold text-text">
        Posts tagged <span className="text-primary">{tag}</span>
      </h1>
      <p className="mt-3 max-w-2xl text-body text-text-muted">
        {rows.length} {rows.length === 1 ? "post" : "posts"} on this topic.
      </p>

      <ul className="mt-10 flex flex-col gap-10">
        {rows.map((post) => (
          <PostRow key={post.slug} post={post} />
        ))}
      </ul>

      <SubscribeForm source="blog_tag" className="mt-16 border-t border-border pt-10" />
    </section>
  );
}
