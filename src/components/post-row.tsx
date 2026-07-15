import Image from "next/image";
import Link from "next/link";
import { ReadingTimePill } from "@/components/reading-time-pill";
import { FOCUS_RING as RING } from "@/lib/focus-ring";
import { formatPostDate, type PostRowData } from "@/lib/blog-view";

// The row's data contract lives in the fs-free `blog-view` core; re-exported
// here so component-side callers can keep importing it from the component.
export type { Cover, PostRowData } from "@/lib/blog-view";

/**
 * One post row in a listing: cover thumbnail, title link, date + reading time,
 * excerpt, and tag pills. Presentational and hook-free, so it renders both in
 * the server-rendered tag archive (`/blog/tags/[tag]`) and inside the client
 * filter island (`blog-list.tsx`) - one row markup, no drift. The parent owns
 * the wrapping `<ul>`; this renders the `<li>`.
 */
export function PostRow({ post }: { post: PostRowData }) {
  return (
    <li className="grid gap-5 border-b border-border pb-10 last:border-b-0 sm:grid-cols-[200px_1fr]">
      {post.cover ? (
        <Link
          href={`${post.basePath}/${post.slug}`}
          className={`block self-center overflow-hidden rounded-lg border-[0.5px] border-border ${RING}`}
        >
          <Image
            src={post.cover}
            alt={post.cover.alt}
            sizes="(max-width: 640px) 100vw, 200px"
            placeholder={post.pixelated ? "empty" : "blur"}
            className="aspect-[16/10] w-full object-cover"
            style={post.pixelated ? { imageRendering: "pixelated" } : undefined}
          />
        </Link>
      ) : null}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-h3 font-semibold">
            <Link
              href={`${post.basePath}/${post.slug}`}
              className={`rounded-sm text-text hover:text-primary ${RING}`}
            >
              {post.title}
            </Link>
          </h2>
          {post.isNew ? (
            <span className="rounded-full bg-accent px-2 py-0.5 text-caption font-medium text-accent-foreground">
              New
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <p className="text-caption text-text-subtle">
            <time dateTime={post.date}>{formatPostDate(post.date)}</time>
          </p>
          <ReadingTimePill minutes={post.minutes} />
        </div>
        <p className="mt-3 text-body text-text-muted">{post.excerpt}</p>
        {post.tags.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-border bg-muted px-3 py-1 text-caption text-secondary"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}
