import posthog from "posthog-js";
import { analytics } from "@/lib/analytics";

/**
 * Idempotent browser init for PostHog (spec 0014). Called at MODULE scope by the
 * provider so the SDK is loaded before any React effect fires: child effects run
 * before parent effects, so an effect-based init let the first `$pageview`
 * capture run pre-init and be silently dropped (posthog-js `capture()`
 * early-returns when not loaded and does not buffer) - the landing pageview was
 * lost every session (engineer/analytics review of PR #47).
 *
 * Safe to call from anywhere, including `global-error.tsx`, which renders outside
 * the provider tree: the `typeof window` guard makes it a no-op during SSR, and
 * the `started` latch means repeated calls only init once.
 */
let started = false;

export function initPostHogBrowser(): typeof posthog {
  if (started || typeof window === "undefined") return posthog;
  started = true;
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
  return posthog;
}

export { posthog };
