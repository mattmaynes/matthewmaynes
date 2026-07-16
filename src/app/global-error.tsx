"use client";

import { useEffect } from "react";
import { ThemeScript } from "@/components/theme-script";
import { applyStoredTheme } from "@/lib/theme";
import { recoverFromChunkError } from "@/lib/chunk-recovery";
import { clientAnalyticsEnabled, initPostHogBrowser } from "@/lib/posthog-browser";
import "./globals.css";

/**
 * Root error boundary (spec 0014). When a render error escapes every nested
 * boundary it replaces the whole document, so this file must render its own
 * <html>/<body>. It keeps <ThemeScript> for the SERVER-rendered case, but when
 * the boundary mounts on the CLIENT that inline script never runs (React does
 * not execute injected scripts and owns the <html> className), so the effect
 * also calls applyStoredTheme() to re-apply the visitor's light/dark choice -
 * without it the fallback always painted light. A stale-deploy ChunkLoadError is
 * reloaded to the fresh build; otherwise the crash is reported to PostHog Error
 * tracking (NOT double-counted: a boundary-caught render error never reaches the
 * global handler) and the branded fallback shows.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Re-apply the theme first so the fallback matches the site even though the
    // pre-paint inline script never executed on this client-mounted document.
    applyStoredTheme();
    if (recoverFromChunkError(error)) return;
    if (clientAnalyticsEnabled()) initPostHogBrowser().captureException(error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col items-center justify-center gap-6 bg-bg p-8 text-center font-sans text-text">
        <div className="flex flex-col gap-3">
          <h1 className="text-h1 font-bold">Something went wrong</h1>
          <p className="text-text-muted">
            An unexpected error occurred. The issue has been logged.
          </p>
        </div>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
