import Image from "next/image";
import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon } from "@/components/blog-icons";
import type { BlogImage } from "@/lib/blog-images";

/**
 * Previous / next post navigation at the bottom of a post (spec 0021).
 * Presentational only (no hooks / server APIs), so it renders inside the
 * Server-Component post page like `ReadingTimePill`. Covers are resolved on the
 * server and passed in as static imports (the `blog-images.ts` pattern, learnings
 * 0005), so the tile keeps `placeholder="blur"` / pixelated behaviour.
 *
 * `previous` is the chronologically older post, `next` the newer one (see
 * `getAdjacentPosts`). Either may be absent (a boundary post), and if both are
 * absent nothing renders.
 *
 * Layout: mobile-first `flex-col-reverse` puts Next (second in DOM) on top and
 * Previous below; `sm:flex-row` lays Previous on the left and Next on the right.
 * When only one side exists it is aligned to its correct edge so a lone Next still
 * sits on the right.
 */
export type PostNavItem = {
  slug: string;
  title: string;
  cover?: BlogImage;
};

// The shared focus-ring treatment (matches the blog listing cards): a 2px ring
// offset off the element, in the Harbor ring tokens.
const RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset";

function NavTile({
  item,
  direction,
}: {
  item: PostNavItem;
  direction: "prev" | "next";
}) {
  const isPrev = direction === "prev";
  const Arrow = isPrev ? ArrowLeftIcon : ArrowRightIcon;
  return (
    <Link
      href={`/blog/${item.slug}`}
      className={`group flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-3 transition-colors hover:border-border-strong sm:w-[calc(50%-0.5rem)] ${RING} ${
        // For "next", reverse the row so the text sits left and the arrow right,
        // and right-align the label/title. DOM order stays arrow -> cover -> text.
        isPrev ? "" : "flex-row-reverse text-right"
      }`}
    >
      <Arrow className="h-5 w-5 shrink-0 text-text-subtle transition-colors group-hover:text-primary" />
      {item.cover ? (
        <Image
          src={item.cover}
          alt=""
          sizes="96px"
          placeholder={item.cover.pixelated ? "empty" : "blur"}
          className="h-14 w-20 shrink-0 rounded-md border-[0.5px] border-border object-cover"
          style={item.cover.pixelated ? { imageRendering: "pixelated" } : undefined}
        />
      ) : null}
      <div className="min-w-0">
        <span className="block text-caption text-text-subtle">
          {isPrev ? "Previous post" : "Next post"}
        </span>
        <span className="mt-0.5 line-clamp-2 text-body font-semibold text-text group-hover:text-primary">
          {item.title}
        </span>
      </div>
    </Link>
  );
}

export function PostNav({
  previous,
  next,
  className,
}: {
  previous?: PostNavItem | null;
  next?: PostNavItem | null;
  className?: string;
}) {
  if (!previous && !next) return null;

  // Both -> spread to the two edges; a lone tile aligns to its own edge so Next
  // is always on the right and Previous always on the left, even when solo.
  const justify =
    previous && next
      ? "sm:justify-between"
      : previous
        ? "sm:justify-start"
        : "sm:justify-end";

  return (
    <nav aria-label="More posts" className={className}>
      <div className={`flex flex-col-reverse gap-4 sm:flex-row sm:items-stretch ${justify}`}>
        {previous ? <NavTile item={previous} direction="prev" /> : null}
        {next ? <NavTile item={next} direction="next" /> : null}
      </div>
    </nav>
  );
}
