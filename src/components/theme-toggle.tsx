"use client";

import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui";

function applyTheme(isDark: boolean) {
  document.documentElement.classList.toggle("dark", isDark);
}

/**
 * Subscribe to the resolved theme. The source of truth is the `.dark` class on
 * <html> (set pre-paint by ThemeScript), watched via MutationObserver. We also
 * follow OS changes here, but only while the user has made no explicit choice -
 * applying a system change flips the class, which the observer turns into a
 * re-render.
 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = (event: MediaQueryListEvent) => {
    if (localStorage.getItem("theme")) return; // explicit choice wins
    applyTheme(event.matches);
  };
  mql.addEventListener("change", onSystemChange);

  return () => {
    observer.disconnect();
    mql.removeEventListener("change", onSystemChange);
  };
}

function getSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Header theme toggle. Reads the resolved theme from <html>, lets the user
 * override the OS setting (persisted in localStorage under "theme"), and keeps
 * the icon in sync. Dependency-free.
 */
export function ThemeToggle() {
  const isDark = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  function toggle() {
    const next = isDark ? "light" : "dark";
    localStorage.setItem("theme", next);
    applyTheme(next === "dark");
  }

  const label = isDark ? "Switch to light theme" : "Switch to dark theme";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">
        {isDark ? (
          // Sun: click to go light.
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        ) : (
          // Moon: click to go dark (also the server-render default).
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        )}
      </span>
    </Button>
  );
}
