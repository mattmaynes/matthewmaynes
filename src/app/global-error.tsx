"use client";

import { useEffect } from "react";
import { ThemeScript } from "@/components/theme-script";
import { clientAnalyticsEnabled, initPostHogBrowser } from "@/lib/posthog-browser";
import "./globals.css";

/**
 * Root error boundary (spec 0014). When a render error escapes every nested
 * boundary it replaces the whole document, so this file must render its own
 * <html>/<body> (including <ThemeScript> so the fallback honours the visitor's
 * light/dark choice). It reports the crash to PostHog Error tracking - this is
 * NOT double-counted by `capture_exceptions`, because a boundary-caught render
 * error never reaches the global handler - then shows a branded fallback.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
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
