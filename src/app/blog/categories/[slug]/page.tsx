import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedPosts, newPostSlug } from "@/lib/blog";
import {
  deriveCategories,
  categorySlug,
  categoryFromSlug,
  filterByCategory,
} from "@/lib/blog-view";
import { toPostRows } from "@/lib/post-summaries";
import { PostRow } from "@/components/post-row";
import { SubscribeForm } from "@/components/subscribe-form";
import { FOCUS_RING as RING } from "@/lib/focus-ring";

type Params = { slug: string };

// Reference "now" for the "New" badge, captured once at module load - i.e. at
// build/process start for these pages (learnings 0012, mirrors the listing).
// Kept out of render so the component stays pure.
const NOW_MS = Date.now();

// Re-render every 60s (shared ISR window, spec 0035) so a scheduled post joins its
// category archive on its own once its publishAt passes, with no deploy. NOTE: the
// set of category PAGES is still baked at build (dynamicParams=false below), but
// the category taxonomy is fixed (spec 0038), so a new page only appears when a
// brand-new category is added to CATEGORIES and used - a code change that rebuilds.
export const revalidate = 60;

// Every category with posts gets a page, baked at build; an unknown slug is a 404,
// never a render (dynamicParams=false), so /blog/categories/<garbage> is a clean
// not-found.
export const dynamicParams = false;

// One page per category that has published posts. The params derive from the
// posts, so a category with no posts yet has no page (deriveCategories omits it).
export function generateStaticParams(): Params[] {
  return deriveCategories(getPublishedPosts()).map((category) => ({
    slug: categorySlug(category),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const posts = getPublishedPosts();
  const category = categoryFromSlug(slug, deriveCategories(posts));
  if (!category) return { title: "Blog" };
  const count = filterByCategory(posts, category, "").length;
  const plural = count === 1 ? "post" : "posts";
  return {
    // Layout appends " - Matthew Maynes"; this is the route-unique title.
    title: `Posts in "${category}" - Blog`,
    description: `${count} ${plural} in the "${category}" category on the Matthew Maynes blog - notes on engineering, leadership, nature, and life.`,
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const posts = getPublishedPosts();
  const category = categoryFromSlug(slug, deriveCategories(posts));
  if (!category) notFound();

  // Posts in this category, already newest-first from getAllPosts. The "New" badge
  // slug is derived over ALL posts (not this category's subset), so it is the same
  // global badge shown on /blog - a post is never "New" only category-locally.
  const rows = toPostRows(
    filterByCategory(posts, category, ""),
    newPostSlug(posts, NOW_MS, 30),
  );

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-12 sm:py-16">
      <Link
        href="/blog"
        className={`inline-block rounded-sm text-caption text-text-subtle hover:text-primary ${RING}`}
      >
        &larr; All posts
      </Link>
      <h1 className="mt-3 text-h1 font-bold text-text">
        Posts in <span className="text-primary">{category}</span>
      </h1>
      <p className="mt-3 max-w-2xl text-body text-text-muted">
        {rows.length} {rows.length === 1 ? "post" : "posts"} on this theme.
      </p>

      <ul className="mt-10 flex flex-col gap-10">
        {rows.map((post) => (
          <PostRow key={post.slug} post={post} />
        ))}
      </ul>

      <SubscribeForm source="blog_category" className="mt-16 border-t border-border pt-10" />
    </section>
  );
}
