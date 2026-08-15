import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * `GET /v1/captcha/pako` - serves the `pako` inflate build from this origin
 * (spec 0043), the sibling of the wasm route next door.
 *
 * Same job, different asset. `cap-widget` needs to decompress the instrumentation
 * program, and on a browser with no `DecompressionStream` (pre-2023 Safari/Firefox)
 * it falls back to injecting a `<script>` for `pako` from a public CDN. That would
 * be a third-party origin on the site, reached only by the visitors least likely to
 * notice why the check stalled. `window.CAP_PAKO_URL` overrides the URL exactly as
 * `window.CAP_CUSTOM_WASM_URL` overrides the wasm one, so the fallback stays
 * same-origin and the "no third-party origins" property holds on every browser
 * rather than most of them.
 *
 * The version is pinned to exactly 2.1.0, no caret: that is the build the widget
 * was written against, and it asserts the global shape (`window.pako.inflateRaw`)
 * on load. This is a classic script tag, not a module, so the global is the
 * contract - a major bump that reshapes it would break the fallback silently.
 *
 * Nothing imports the file, so it is invisible to the dependency tracer -
 * `next.config.ts` `outputFileTracingIncludes` copies it into the standalone
 * runtime, same as the wasm module and the contact notification template. Read
 * once at module load, like both.
 */

const PAKO_PATH = "node_modules/pako/dist/pako_inflate.min.js";

const pakoScript = loadPako();

function loadPako(): Buffer | null {
  try {
    return readFileSync(join(process.cwd(), PAKO_PATH));
  } catch (err) {
    // Not fatal, and only reachable on a browser that lacks DecompressionStream:
    // the widget reports a failed challenge the visitor can retry. Loud so a
    // broken build is visible rather than a puzzle nobody can reproduce.
    console.error("captcha: could not read the pako inflate build:", err);
    return null;
  }
}

export function GET(): Response {
  if (!pakoScript) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(pakoScript), {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      // Content is pinned by the lockfile and only changes with a deploy, so it
      // is safe to cache hard - and it saves the fetch on every later page view.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
