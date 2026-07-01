"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "@rogueoak/icons";
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
      variant="outline"
      size="icon"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      <span aria-hidden="true">
        {isDark ? (
          // Sun: click to go light.
          <Sun className="h-5 w-5" />
        ) : (
          // Moon: click to go dark (also the server-render default).
          <Moon className="h-5 w-5" />
        )}
      </span>
    </Button>
  );
}
