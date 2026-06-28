/**
 * Pre-paint theme script. Rendered into <head> and run before first paint so the
 * resolved theme (.dark on <html> or not) is applied with no flash of the wrong
 * theme. Reads localStorage.theme first (explicit user choice wins), otherwise
 * falls back to the OS prefers-color-scheme setting. Dependency-free.
 */
import { themeScriptSource } from "@/lib/theme";

export function ThemeScript() {
  // Runs before hydration; intentionally not a React effect. The source lives in
  // src/lib/theme.js so the resolution logic is unit-tested (tests/theme.test.mjs).
  return <script dangerouslySetInnerHTML={{ __html: themeScriptSource }} />;
}
