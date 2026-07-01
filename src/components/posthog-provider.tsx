"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";
import { analytics } from "@/lib/analytics";
import { PostHogPageView } from "@/components/posthog-pageview";

/**
 * Client-side PostHog bootstrap (spec 0014): product analytics, session replay,
 * and client exception autocapture. Mounted once in the root layout.
 *
 * Privacy by construction:
 * - `session_recording.maskAllInputs: true` - no typed value (contact form or
 *   otherwise) is ever stored in a recording. The public-repo/PII rule is
 *   enforced structurally, not by remembering to be careful.
 * - `persistence: "localStorage"` - cookieless. An anonymous id persists across
 *   pages/sessions in localStorage but no tracking cookie is set, which is the
 *   confirmed consent model (no banner; see spec 0014).
 *
 * `api_host` is the same-origin `/ingest` proxy (next.config.ts rewrites), so no
 * request goes directly to `*.posthog.com`. Pageviews are captured manually by
 * <PostHogPageView> because the App Router soft-navigates.
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(analytics.key, {
      api_host: analytics.host,
      ui_host: analytics.uiHost,
      capture_pageview: false,
      capture_pageleave: true,
      capture_exceptions: true,
      persistence: "localStorage",
      session_recording: {
        maskAllInputs: true,
      },
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}
