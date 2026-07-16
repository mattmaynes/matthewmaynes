/**
 * Theme resolution - the single source of truth for "is dark active?".
 *
 * Kept fs-free and framework-free so it can be both imported by the pre-paint
 * <script> in `theme-script.tsx` AND unit-tested directly (tests/theme.test.ts).
 * The inline source and `resolveDark` deliberately encode the SAME rule; the test
 * asserts they agree so they cannot drift.
 */

/**
 * Resolve whether dark mode should be active.
 * Explicit stored choice wins; otherwise fall back to the OS preference.
 * @param stored - localStorage 'theme' value
 * @param prefersDark - matchMedia('(prefers-color-scheme: dark)').matches
 */
export function resolveDark(
  stored: string | null | undefined,
  prefersDark: boolean,
): boolean {
  return stored ? stored === "dark" : prefersDark;
}

/**
 * The pre-paint IIFE injected into <head>. Runs before first paint, dependency-
 * free, and applies `.dark` on <html> using the same rule as `resolveDark`.
 * Wrapped in try/catch so a privacy mode that throws on localStorage never blocks
 * paint.
 */
export const themeScriptSource =
  "(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();";

/**
 * Apply the resolved theme to <html> from JS (not the inline <script>).
 *
 * The pre-paint `themeScriptSource` only runs in SERVER-rendered HTML. A boundary
 * that mounts on the CLIENT and renders its own document - `app/global-error.tsx`
 * replaces the whole tree - never gets that script executed (React does not run
 * `dangerouslySetInnerHTML` scripts on client mount, and it owns the <html>
 * className, so any class the script added is reconciled away). Such a boundary
 * would paint in the default light theme regardless of the visitor's choice.
 * Calling this from the boundary's effect re-applies the same rule as
 * `resolveDark`. A no-op with no DOM (SSR) and swallows a privacy mode that
 * throws on localStorage.
 */
export function applyStoredTheme(): void {
  if (typeof document === "undefined") return;
  try {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle(
      "dark",
      resolveDark(stored, prefersDark),
    );
  } catch {
    // localStorage/matchMedia blocked (privacy mode); keep the default theme.
  }
}
