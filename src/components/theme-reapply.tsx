"use client";

import { useEffect } from "react";
import { applyStoredTheme } from "@/lib/theme";

/**
 * Re-applies the visitor's stored theme on mount. Rendered by `not-found.tsx`.
 *
 * A `notFound()` thrown from a dynamic route (e.g. /blog/[slug], /projects/[slug],
 * the drafts/tags routes) renders the not-found boundary through a client re-render
 * of the persistent root layout. That re-render reconciles <html>'s className back
 * to its JSX value ("h-full antialiased"), stripping the `.dark` class the pre-paint
 * ThemeScript added - so the 404 paints in light mode even though the visitor chose
 * dark. `suppressHydrationWarning` only covers the initial hydration, not this later
 * re-render. Calling applyStoredTheme() in an effect re-affirms the choice after the
 * boundary settles, mirroring error.tsx / global-error.tsx. Renders nothing.
 */
export function ThemeReapply() {
  useEffect(() => {
    applyStoredTheme();
  }, []);
  return null;
}
