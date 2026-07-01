"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import type { StaticImageData } from "next/image";
import { SearchIcon } from "@/components/blog-icons";
import {
  formatPostDate,
  deriveTags,
  resolveActiveTag,
  filterPosts,
} from "@/lib/blog-view";

/** A cover image passed down from the server: a static import (carrying its
 * blurDataURL) plus alt text. Resolved on the server via `getBlogImage` so the
 * client island never imports `blog-images.ts` (learnings 0005). */
type Cover = StaticImageData & { alt: string };

/** A serializable post summary. The server page resolves the cover and computes
 * `isNew` (newest AND recent) so the client renders straight from the props. */
export type BlogListPost = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  tags: string[];
  cover?: Cover;
  pixelated: boolean;
  isNew: boolean;
};

// A tiny store over the URL's `?tag=` value, so the chips read the active filter
// WITHOUT `useSearchParams` - that hook forces this statically-generated page to
// bail out to client-only rendering, which would drop the whole post list from
// the SSG HTML (bad for SEO and the smoke test). `history.replaceState` does not
// emit `popstate`, so `selectTag` pokes the subscribers directly. The server
// snapshot is "" (no query at build), so SSR renders the unfiltered list and the
// client re-syncs after hydration via useSyncExternalStore (no set-state-in-
// effect, no hydration-mismatch hacks - the same pattern as the theme toggle,
// learnings 0001).
const urlTagListeners = new Set<() => void>();

function notifyUrlTag() {
  for (const listener of urlTagListeners) listener();
}

function subscribeUrlTag(callback: () => void) {
  urlTagListeners.add(callback);
  window.addEventListener("popstate", callback);
  return () => {
    urlTagListeners.delete(callback);
    window.removeEventListener("popstate", callback);
  };
}

function readUrlTag() {
  return new URLSearchParams(window.location.search).get("tag") ?? "";
}

/** Shared focus-ring classes, matching the existing links on this page. */
const RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset";

/**
 * The blog listing's filter/search island. Owns the tag-chip + search UI and
 * renders the (moved-over, un-restyled) post rows. The active tag lives in the
 * URL (`?tag=`) so a filtered view is shareable; search is local input state.
 */
export function BlogList({ posts }: { posts: BlogListPost[] }) {
  const [query, setQuery] = useState("");

  // Tag set + active-tag resolution + filtering all live in the pure, fs-free
  // `blog-view` core so they are unit-tested against a multi-post fixture
  // (learnings 0009) rather than trapped in this island.
  const allTags = deriveTags(posts);

  // The URL is the source of truth for the tag filter (shareable/bookmarkable);
  // it restores the active tag on load. `resolveActiveTag` maps `?tag=` back to
  // a known tag case-insensitively; an unknown/absent value means "All".
  const tagParam = useSyncExternalStore(subscribeUrlTag, readUrlTag, () => "");
  const activeTag = resolveActiveTag(tagParam, allTags);

  function selectTag(tag: string | null) {
    // Reflect the filter in the URL without a scroll jump or a back-history
    // entry. `history.replaceState` is synchronous (so the store reads the fresh
    // value on notify) and keeps this a pure client-side filter - no server
    // round trip, which router.replace would incur.
    const qs = tag ? `?tag=${encodeURIComponent(tag.toLowerCase())}` : "";
    window.history.replaceState(null, "", `${window.location.pathname}${qs}`);
    notifyUrlTag();
  }

  // Filter by the active tag first, then narrow by the search query over
  // title + excerpt + tags (both case-insensitive, composed) - in the pure core.
  const filtered = filterPosts(posts, activeTag, query);

  const chipBase = `rounded-full border px-3 py-1 text-caption transition-colors ${RING}`;
  const chipOn = "border-primary bg-primary text-primary-foreground";
  // Inactive chips read apart from the static, non-interactive post tag pills:
  // hovering darkens the border and text so the affordance is clear.
  const chipOff =
    "border-border bg-muted text-text-muted hover:border-border-strong hover:text-text";

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {allTags.length > 0 ? (
          <ul className="flex flex-wrap gap-2" aria-label="Filter posts by tag">
            <li>
              <button
                type="button"
                aria-pressed={activeTag === null}
                onClick={() => selectTag(null)}
                className={`${chipBase} ${activeTag === null ? chipOn : chipOff}`}
              >
                All
              </button>
            </li>
            {allTags.map((tag) => {
              const on = activeTag?.toLowerCase() === tag.toLowerCase();
              return (
                <li key={tag}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => selectTag(tag)}
                    className={`${chipBase} ${on ? chipOn : chipOff}`}
                  >
                    {tag}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="relative sm:w-64">
          <label htmlFor="blog-search" className="sr-only">
            Search posts
          </label>
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-subtle"
          />
          <input
            id="blog-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search posts"
            className={`w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-body text-text placeholder:text-text-subtle ${RING}`}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-10 rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-body text-text-muted">
            No posts match your search. Try a different keyword or clear the
            filter.
          </p>
        </div>
      ) : (
        <ul className="mt-10 flex flex-col gap-10">
          {filtered.map((post) => (
            <li
              key={post.slug}
              className="grid gap-5 border-b border-border pb-10 last:border-b-0 sm:grid-cols-[200px_1fr]"
            >
              {post.cover ? (
                <Link
                  href={`/blog/${post.slug}`}
                  className={`block overflow-hidden rounded-lg border border-border bg-slate-950 ${RING}`}
                >
                  <Image
                    src={post.cover}
                    alt={post.cover.alt}
                    sizes="(max-width: 640px) 100vw, 200px"
                    placeholder={post.pixelated ? "empty" : "blur"}
                    className="aspect-[16/10] w-full object-contain p-3"
                    style={
                      post.pixelated ? { imageRendering: "pixelated" } : undefined
                    }
                  />
                </Link>
              ) : null}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-h3 font-semibold">
                    <Link
                      href={`/blog/${post.slug}`}
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
                <p className="mt-1 text-caption text-text-subtle">
                  <time dateTime={post.date}>{formatPostDate(post.date)}</time>
                </p>
                <p className="mt-3 text-body text-text-muted">{post.excerpt}</p>
                {post.tags.length > 0 ? (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {post.tags.map((tag) => (
                      <li
                        key={tag}
                        className="rounded-full border border-border bg-muted px-3 py-1 text-caption text-text-muted"
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
