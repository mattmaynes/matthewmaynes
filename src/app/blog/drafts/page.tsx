import type { Metadata } from "next";
import Link from "next/link";
import { getDraftPosts } from "@/lib/blog";
import { toPostRows } from "@/lib/post-summaries";
import { PostRow } from "@/components/post-row";
import { FOCUS_RING as RING } from "@/lib/focus-ring";

// The drafts index (spec 0034): lists every unpublished post, linking to
// /blog/drafts/<slug>. Deliberately noindex and not linked from any nav - it is
// reachable only by knowing the URL. Not a subscribe surface.
export const metadata: Metadata = {
  title: "Drafts",
  robots: { index: false, follow: false },
};

export default function DraftsPage() {
  // Drafts never carry the "New" badge (they are unpublished), so newSlug is
  // null; the rows link under /blog/drafts.
  const rows = toPostRows(getDraftPosts(), null, "/blog/drafts");

  return (
    <section className="mx-auto max-w-[1200px] px-6 py-12 sm:py-16">
      <Link
        href="/blog"
        className={`inline-block rounded-sm text-caption text-text-subtle hover:text-primary ${RING}`}
      >
        &larr; All posts
      </Link>
      <h1 className="mt-3 text-h1 font-bold text-text">Drafts</h1>
      <p className="mt-3 max-w-2xl text-body text-text-muted">
        Unpublished posts, visible only here. Not linked from the site and not indexed.
      </p>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-body text-text-muted">No drafts right now.</p>
        </div>
      ) : (
        <ul className="mt-10 flex flex-col gap-10">
          {rows.map((post) => (
            <PostRow key={post.slug} post={post} />
          ))}
        </ul>
      )}
    </section>
  );
}
