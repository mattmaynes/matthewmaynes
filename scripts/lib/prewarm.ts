// Pre-warm the next/image optimizer cache. next/image optimizes on demand, so
// the first request for each image+width encodes it on the fly and only then
// caches it (X-Nextjs-Cache: MISS -> HIT). On a fresh container the cache is
// empty, so the first visitor after a deploy waits on every encode. Warming
// crawls the rendered pages, finds the exact /_next/image URLs they reference
// (sources are content-hashed and widths come from each image's `sizes`, so only
// the live HTML knows them), and requests each so the encode is done before any
// real visitor arrives. (spec 0006, follows feedback 0006.)

// A browser-like Accept header so the optimizer encodes the same variant a real
// client negotiates (WebP today) rather than serving the original passthrough.
const IMAGE_ACCEPT = "image/avif,image/webp,image/apng,*/*";

// Per-request ceiling. Node's fetch waits forever by default, so a container
// that accepts the connection but never responds (a real post-deploy failure
// mode) would otherwise hang the warm until GitHub's 360-min job timeout. The
// try/catch around each fetch absorbs the AbortError, keeping best-effort intact.
const DEFAULT_REQUEST_TIMEOUT_MS = 15000;

/** The message off an unknown thrown value, without assuming it is an Error. */
function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Pull every `/_next/image?...` URL out of a page's HTML - from both `src` and
 * `srcset` (each srcset width is a distinct URL to warm). Unescapes `&amp;`,
 * dedupes, and absolutizes against `origin` when given.
 *
 * @param html
 * @param origin  e.g. "https://example.com"; omit for relative URLs
 */
export function extractImageUrls(html: string, origin = ""): string[] {
  const urls = new Set<string>();
  // Stop at whitespace, quotes, or `>` so a srcset "url 640w, url 750w" yields
  // each URL without its width descriptor or the comma separator. Assumes Next's
  // actual output: HTML-escaped as `&amp;` (not numeric entities) and srcset
  // candidates separated by ", " (a space) - both always true for next/image.
  const re = /\/_next\/image\?[^"'\s>]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const decoded = m[0].replace(/&amp;/g, "&").replace(/,+$/, "");
    urls.add(origin ? new URL(decoded, origin).toString() : decoded);
  }
  return [...urls];
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

export type PrewarmResult = {
  urls: string[];
  warmed: number;
  failed: number;
  pagesOk: number;
};

/**
 * Crawl `routes` on `baseUrl`, collect the image URLs they render, and GET each
 * to populate the optimizer cache. Best-effort: never throws on a single failed
 * request; the caller decides what to do with the counts.
 */
export async function prewarm({
  baseUrl,
  routes,
  fetchImpl = fetch,
  log = () => {},
  concurrency = 6,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
}: {
  baseUrl: string;
  routes: string[];
  fetchImpl?: typeof fetch;
  log?: (msg: string) => void;
  concurrency?: number;
  requestTimeoutMs?: number;
}): Promise<PrewarmResult> {
  const origin = new URL(baseUrl).origin;
  const imageUrls = new Set<string>();
  let pagesOk = 0;

  for (const route of routes) {
    const pageUrl = new URL(route, baseUrl).toString();
    try {
      const res = await fetchImpl(pageUrl, {
        headers: { accept: "text/html" },
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (!res.ok) {
        log(`  page ${route}: HTTP ${res.status} (skipped)`);
        continue;
      }
      pagesOk++;
      const found = extractImageUrls(await res.text(), origin);
      found.forEach((u) => imageUrls.add(u));
      log(`  page ${route}: ${found.length} image url(s)`);
    } catch (err) {
      log(`  page ${route}: ${errMessage(err)} (skipped)`);
    }
  }

  const urls = [...imageUrls];
  let warmed = 0;
  let failed = 0;
  await mapWithConcurrency(urls, concurrency, async (url) => {
    try {
      const res = await fetchImpl(url, {
        headers: { accept: IMAGE_ACCEPT },
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      // Drain the body so the encode completes and the socket frees.
      await res.arrayBuffer();
      if (res.ok) warmed++;
      else {
        failed++;
        log(`  warm ${url}: HTTP ${res.status}`);
      }
    } catch (err) {
      failed++;
      log(`  warm ${url}: ${errMessage(err)}`);
    }
  });

  return { urls, warmed, failed, pagesOk };
}
