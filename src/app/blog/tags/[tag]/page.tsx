import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllPosts } from "@/lib/blog";
import { deriveTags, tagSlug, tagFromSlug, filterPosts } from "@/lib/blog-view";
import { toPostRows } from "@/lib/post-summaries";
import { PostRow } from "@/components/post-row";
import { SubscribeForm } from "@/components/subscribe-form";

type Params = { tag: string };

// Reference "now" for the "New" badge, captured once at module load - i.e. at
// build time for these statically generated pages (learnings 0012, mirrors the
// listing). Kept out of render so the component stays pure.
const NOW_MS = Date.now();

// Every tag gets a page, baked at build; an unknown slug is a 404, never a
// render (dynamicParams=false), so /blog/tags/<garbage> is a clean not-found.
export const dynamicParams = false;

// One page per tag across all posts (including single-post tags). A future tag
// yields a page on the next build with no config change - the params derive
// from the posts.
export function generateStaticParams(): Params[] {
  return deriveTags(getAllPosts()).map((tag) => ({ tag: tagSlug(tag) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { tag: slug } = await params;
  const tag = tagFromSlug(slug, deriveTags(getAllPosts()));
  if (!tag) return { title: "Blog" };
  const count = filterPosts(getAllPosts(), tag, "").length;
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
  const posts = getAllPosts();
  const tag = tagFromSlug(slug, deriveTags(posts));
  if (!tag) notFound();

  // Posts carrying this tag, already newest-first from getAllPosts.
  const rows = toPostRows(filterPosts(posts, tag, ""), NOW_MS);

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-12 sm:py-16">
      <Link
        href="/blog"
        className="text-caption text-text-subtle hover:text-primary"
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
