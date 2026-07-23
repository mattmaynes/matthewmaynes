"use client";

import { useState, useSyncExternalStore } from "react";
import { usePostHog } from "posthog-js/react";
import { SearchIcon } from "@/components/blog-icons";
import { PostRow, type PostRowData } from "@/components/post-row";
import { FOCUS_RING as RING } from "@/lib/focus-ring";
import { clientAnalyticsEnabled } from "@/lib/posthog-browser";
import {
  deriveCategories,
  resolveActiveCategory,
  filterByCategory,
} from "@/lib/blog-view";

/** A serializable post summary. The server page resolves the cover and computes
 * `isNew` (newest AND recent) so the client renders straight from the props.
 * The row shape lives in `post-row.tsx`, shared with the tag archive page. */
export type BlogListPost = PostRowData;

// A tiny store over the URL's `?category=` value, so the chips read the active
// filter WITHOUT `useSearchParams` - that hook forces this statically-generated
// page to bail out to client-only rendering, which would drop the whole post list
// from the SSG HTML (bad for SEO and the smoke test). `history.replaceState` does
// not emit `popstate`, so `selectCategory` pokes the subscribers directly. The
// server snapshot is "" (no query at build), so SSR renders the unfiltered list
// and the client re-syncs after hydration via useSyncExternalStore (no set-state-
// in-effect, no hydration-mismatch hacks - the same pattern as the theme toggle,
// learnings 0001).
const urlCategoryListeners = new Set<() => void>();

function notifyUrlCategory() {
  for (const listener of urlCategoryListeners) listener();
}

function subscribeUrlCategory(callback: () => void) {
  urlCategoryListeners.add(callback);
  window.addEventListener("popstate", callback);
  return () => {
    urlCategoryListeners.delete(callback);
    window.removeEventListener("popstate", callback);
  };
}

function readUrlCategory() {
  return new URLSearchParams(window.location.search).get("category") ?? "";
}

/**
 * The blog listing's filter/search island. Owns the category-chip + search UI and
 * renders the (moved-over, un-restyled) post rows. The active category lives in
 * the URL (`?category=`) so a filtered view is shareable; search is local input
 * state (spec 0038 - categories replace the old tag filter here; tags remain the
 * keyword search and the /blog/tags archives).
 */
export function BlogList({ posts }: { posts: BlogListPost[] }) {
  const [query, setQuery] = useState("");
  const posthog = usePostHog();

  // Category set + active-category resolution + filtering all live in the pure,
  // fs-free `blog-view` core so they are unit-tested against a multi-post fixture
  // (learnings 0009) rather than trapped in this island. `deriveCategories`
  // returns only categories that have posts, in canonical order.
  const allCategories = deriveCategories(posts);

  // The URL is the source of truth for the category filter (shareable/bookmarkable);
  // it restores the active category on load. `resolveActiveCategory` maps
  // `?category=` back to a known category case-insensitively; an unknown/absent
  // value means "All posts".
  const categoryParam = useSyncExternalStore(
    subscribeUrlCategory,
    readUrlCategory,
    () => "",
  );
  const activeCategory = resolveActiveCategory(categoryParam, allCategories);

  function selectCategory(category: string | null) {
    // Reflect the filter in the URL without a scroll jump or a back-history entry.
    // `history.replaceState` is synchronous (so the store reads the fresh value on
    // notify) and keeps this a pure client-side filter - no server round trip,
    // which router.replace would incur.
    const qs = category
      ? `?category=${encodeURIComponent(category.toLowerCase())}`
      : "";
    window.history.replaceState(null, "", `${window.location.pathname}${qs}`);
    notifyUrlCategory();
    // Capture which theme a reader narrows to (or clears) - the signal the whole
    // feature exists for, and one the raw `history.replaceState` above does NOT
    // give the pageview tracker (it doesn't touch `useSearchParams`). The value is
    // the fixed category enum or "all", so it stays a PII-free dimension. Gated by
    // `clientAnalyticsEnabled()` like the subscribe/contact events.
    if (clientAnalyticsEnabled()) {
      posthog?.capture("blog_category_filtered", { category: category ?? "all" });
    }
  }

  // Filter by the active category first, then narrow by the search query over
  // title + excerpt + tags (both case-insensitive, composed) - in the pure core.
  const filtered = filterByCategory(posts, activeCategory, query);

  // The category filter is a chip row: a leading "All posts" chip clears the
  // filter, then one chip per present category. With a small fixed taxonomy this
  // makes every theme visible at a glance and one tap to filter. The active chip
  // is filled; the rest are outlined. Selection drives the URL-backed
  // `selectCategory`, so the filter stays shareable and the pure core is unchanged.
  const chips: { label: string; value: string | null }[] = [
    { label: "All posts", value: null },
    ...allCategories.map((category) => ({ label: category, value: category })),
  ];

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {allCategories.length > 0 ? (
          <div
            role="group"
            aria-label="Filter posts by category"
            className="flex flex-wrap gap-2"
          >
            {chips.map((chip) => {
              const isActive =
                (chip.value?.toLowerCase() ?? null) ===
                (activeCategory?.toLowerCase() ?? null);
              return (
                <button
                  key={chip.label}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => selectCategory(chip.value)}
                  className={`rounded-full border px-3 py-1.5 text-caption font-medium transition-colors ${RING} ${
                    isActive
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-surface text-secondary hover:border-border-strong hover:text-text"
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
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
            className={`h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text placeholder:text-text-subtle ${RING}`}
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
            <PostRow key={post.slug} post={post} />
          ))}
        </ul>
      )}
    </div>
  );
}
