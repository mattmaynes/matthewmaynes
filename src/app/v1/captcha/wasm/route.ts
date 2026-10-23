import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `GET /v1/captcha/wasm` - serves the Cap proof-of-work solver's WebAssembly
 * module from this origin (spec 0043).
 *
 * It exists purely to keep a property the site already has: zero third-party
 * origins in the browser. `cap-widget` otherwise fetches this module from a
 * public CDN the moment it loads, which would be the first cross-origin request
 * on the site and would need an exception in the CSP that is still to come
 * (`next.config.ts`). Pointing `window.CAP_CUSTOM_WASM_URL` at this route keeps
 * the request same-origin. Without the module the widget falls back to a pure-JS
 * solver that is an order of magnitude slower, so this is a real part of the UX,
 * not just a privacy nicety.
 *
 * The widget's other CDN reach - `pako`, loaded to decompress the instrumentation
 * program on a browser with no `DecompressionStream` - has the same kind of override
 * hook and is served the same way from `/v1/captcha/pako` next door. Between the two
 * routes the widget has no path left to a third-party origin.
 *
 * The file ships inside `@cap.js/wasm`, is never imported by any bundle, and so
 * is invisible to the dependency tracer - `next.config.ts` `outputFileTracingIncludes`
 * copies it into the standalone runtime, exactly as it does for the contact
 * notification template. Read once at module load, like that template.
 */

const WASM_PATH = "node_modules/@cap.js/wasm/browser/cap_wasm_bg.wasm";

const wasmModule = loadWasm();

function loadWasm(): Buffer | null {
  try {
    return readFileSync(join(process.cwd(), WASM_PATH));
  } catch (err) {
    // Not fatal: the widget falls back to its JS solver, which is slow but
    // correct. Loud so a broken build is visible rather than just sluggish.
    console.error("captcha: could not read the Cap wasm solver:", err);
    return null;
  }
}

export function GET(): Response {
  if (!wasmModule) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(wasmModule), {
    headers: {
      "Content-Type": "application/wasm",
      // Content is pinned by the lockfile and only changes with a deploy, so it
      // is safe to cache hard - and it saves the fetch on every later page view.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
