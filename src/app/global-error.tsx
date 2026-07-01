"use client";

import posthog from "posthog-js";
import { useEffect } from "react";
import "./globals.css";

/**
 * Root error boundary (spec 0014). When a render error escapes every nested
 * boundary it replaces the whole document, so this file must render its own
 * <html>/<body>. It reports the crash to PostHog Error tracking, then shows a
 * minimal branded fallback with a retry.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    posthog.captureException(error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col items-center justify-center gap-6 bg-bg p-8 text-center font-sans text-text">
        <div className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-muted">
            An unexpected error occurred. The issue has been logged.
          </p>
        </div>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-primary px-4 py-2 font-medium text-on-primary"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
