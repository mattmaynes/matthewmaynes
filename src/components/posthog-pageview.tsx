"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { usePostHog } from "posthog-js/react";
import { Suspense, useEffect } from "react";

/**
 * Fires a `$pageview` on every App Router navigation (spec 0014). The client
 * SDK is initialized with `capture_pageview: false` because the App Router does
 * not do full page loads on soft navigation, so the SDK's automatic first-load
 * pageview would miss every route change. `useSearchParams` forces a Suspense
 * boundary, so the inner hook is isolated in its own component.
 */
function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const posthog = usePostHog();

  useEffect(() => {
    if (!pathname || !posthog) return;
    let url = window.origin + pathname;
    const query = searchParams?.toString();
    if (query) url += `?${query}`;
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, posthog]);

  return null;
}

export function PostHogPageView() {
  return (
    <Suspense fallback={null}>
      <PageViewTracker />
    </Suspense>
  );
}
