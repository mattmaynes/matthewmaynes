import { ClockIcon } from "@/components/blog-icons";

/**
 * The reading-time pill - a `Clock` glyph + "N min read" - shared by the blog
 * post header (spec 0011) and the listing rows (spec 0015) so both render the
 * identical treatment. Presentational only (no hooks/server APIs), so it works
 * inside the Server-Component post page and the client listing island alike.
 */
export function ReadingTimePill({ minutes }: { minutes: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-caption text-text-muted">
      <ClockIcon className="h-3.5 w-3.5" />
      {minutes} min read
    </span>
  );
}
