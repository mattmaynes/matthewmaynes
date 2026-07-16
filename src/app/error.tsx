"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import { applyStoredTheme } from "@/lib/theme";
import { recoverFromChunkError } from "@/lib/chunk-recovery";
import { clientAnalyticsEnabled, initPostHogBrowser } from "@/lib/posthog-browser";

/**
 * Route-level error boundary. For a CLIENT-side error it renders inside the
 * persistent root layout (Header/Footer, and the `.dark` already on <html>).
 * But a SERVER-side render error is served as Next's bare `<html
 * id="__next_error__">` document - the root layout, and its pre-paint
 * ThemeScript, never run - so the fallback would paint light regardless of the
 * visitor's choice. applyStoredTheme() re-applies the theme in the effect to
 * cover that path; it is a harmless re-affirm on the client-error path.
 *
 * First job is recovery: a `ChunkLoadError` from a tab left open across a deploy
 * is reloaded to the fresh build instead of shown (see chunk-recovery). Anything
 * else is reported to PostHog and gets the branded fallback below.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Re-apply the theme first: on a server-rendered error the pre-paint script
    // never ran, so without this the fallback is stuck in light mode.
    applyStoredTheme();
    // Stale-deploy chunk error -> reload to the current build; skip the report.
    if (recoverFromChunkError(error)) return;
    if (clientAnalyticsEnabled()) initPostHogBrowser().captureException(error);
  }, [error]);

  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-6 py-24 text-center sm:py-32">
      <p className="text-caption font-medium uppercase tracking-wide text-text-muted">
        Error
      </p>
      <h1 className="text-h1 font-bold text-text">Something went wrong</h1>
      <p className="max-w-md text-body text-text-muted">
        An unexpected error occurred and has been logged. Try again, or head back
        home.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button type="button" variant="primary" size="lg" onClick={() => reset()}>
          Try again
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </section>
  );
}
