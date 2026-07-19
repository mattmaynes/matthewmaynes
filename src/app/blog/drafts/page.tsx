import type { Metadata } from "next";
import Link from "next/link";
import { getPreviewPosts } from "@/lib/blog";
import { toPostRows } from "@/lib/post-summaries";
import { PostRow } from "@/components/post-row";
import { FOCUS_RING as RING } from "@/lib/focus-ring";

// Re-render every 60s (shared ISR window, spec 0035) so a scheduled post leaves
// this preview list on its own once its publishAt passes (it moves to /blog).
export const revalidate = 60;

// The preview index (spec 0034/0035): lists every not-yet-public post - drafts
// AND scheduled posts - linking to /blog/drafts/<slug>. Deliberately noindex and
// not linked from any nav; reachable only by knowing the URL. Not a subscribe
// surface. Re-render on the shared interval so a scheduled post drops OFF this
// list on its own once it publishes (it moves to /blog).
export const metadata: Metadata = {
  title: "Drafts",
  robots: { index: false, follow: false },
};

export default function DraftsPage() {
  // Preview posts never carry the "New" badge (they are unpublished), so newSlug
  // is null; each row links under /blog/drafts and carries a Draft/Scheduled
  // marker (markPreview).
  const rows = toPostRows(getPreviewPosts(), null, "/blog/drafts", true);

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
        Unpublished posts - drafts and scheduled posts - visible only here. Not
        linked from the site and not indexed. A scheduled post moves to the blog
        on its own once its publish time passes.
      </p>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border bg-surface px-6 py-14 text-center">
          <h2 className="text-h3 font-semibold text-text">
            No drafts or scheduled posts
          </h2>
          <p className="mx-auto mt-2 max-w-md text-body text-text-muted">
            Posts you are working on or have scheduled will appear here. Nothing is
            waiting to go live right now.
          </p>
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
