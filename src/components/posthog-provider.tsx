"use client";

import { PostHogProvider as PHProvider } from "posthog-js/react";
import { initPostHogBrowser, posthog } from "@/lib/posthog-browser";
import { PostHogPageView } from "@/components/posthog-pageview";

/**
 * Client-side PostHog bootstrap (spec 0014): product analytics, session replay,
 * and client exception autocapture. Mounted once in the root layout.
 *
 * Init runs at module load (below), not in an effect, so the SDK is loaded before
 * <PostHogPageView>'s effect fires the first $pageview - see posthog-browser.ts.
 * Config (input masking, cookieless persistence, same-origin /ingest proxy) also
 * lives there so the provider and global-error boundary share one init.
 */
initPostHogBrowser();

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}
