/**
 * Pre-paint theme script. Rendered into <head> and run before first paint so the
 * resolved theme (.dark on <html> or not) is applied with no flash of the wrong
 * theme. Reads localStorage.theme first (explicit user choice wins), otherwise
 * falls back to the OS prefers-color-scheme setting. Dependency-free.
 */
const script = `(function(){try{var s=localStorage.getItem('theme');var d=s?s==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

export function ThemeScript() {
  // Runs before hydration; intentionally not a React effect.
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
