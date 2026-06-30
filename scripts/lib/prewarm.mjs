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

/**
 * Pull every `/_next/image?...` URL out of a page's HTML - from both `src` and
 * `srcset` (each srcset width is a distinct URL to warm). Unescapes `&amp;`,
 * dedupes, and absolutizes against `origin` when given.
 *
 * @param {string} html
 * @param {string} [origin]  e.g. "https://example.com"; omit for relative URLs
 * @returns {string[]}
 */
export function extractImageUrls(html, origin = "") {
  const urls = new Set();
  // Stop at whitespace, quotes, or `>` so a srcset "url 640w, url 750w" yields
  // each URL without its width descriptor or the comma separator.
  const re = /\/_next\/image\?[^"'\s>]+/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const decoded = m[0].replace(/&amp;/g, "&").replace(/,+$/, "");
    urls.add(origin ? new URL(decoded, origin).toString() : decoded);
  }
  return [...urls];
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
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

/**
 * Crawl `routes` on `baseUrl`, collect the image URLs they render, and GET each
 * to populate the optimizer cache. Best-effort: never throws on a single failed
 * request; the caller decides what to do with the counts.
 *
 * @param {object} opts
 * @param {string} opts.baseUrl
 * @param {string[]} opts.routes               page paths to crawl
 * @param {typeof fetch} [opts.fetchImpl]
 * @param {(msg: string) => void} [opts.log]
 * @param {number} [opts.concurrency]
 * @returns {Promise<{urls: string[], warmed: number, failed: number, pagesOk: number}>}
 */
export async function prewarm({
  baseUrl,
  routes,
  fetchImpl = fetch,
  log = () => {},
  concurrency = 6,
}) {
  const origin = new URL(baseUrl).origin;
  const imageUrls = new Set();
  let pagesOk = 0;

  for (const route of routes) {
    const pageUrl = new URL(route, baseUrl).toString();
    try {
      const res = await fetchImpl(pageUrl, { headers: { accept: "text/html" } });
      if (!res.ok) {
        log(`  page ${route}: HTTP ${res.status} (skipped)`);
        continue;
      }
      pagesOk++;
      const found = extractImageUrls(await res.text(), origin);
      found.forEach((u) => imageUrls.add(u));
      log(`  page ${route}: ${found.length} image url(s)`);
    } catch (err) {
      log(`  page ${route}: ${err.message} (skipped)`);
    }
  }

  const urls = [...imageUrls];
  let warmed = 0;
  let failed = 0;
  await mapWithConcurrency(urls, concurrency, async (url) => {
    try {
      const res = await fetchImpl(url, { headers: { accept: IMAGE_ACCEPT } });
      // Drain the body so the encode completes and the socket frees.
      await res.arrayBuffer();
      if (res.ok) warmed++;
      else {
        failed++;
        log(`  warm ${url}: HTTP ${res.status}`);
      }
    } catch (err) {
      failed++;
      log(`  warm ${url}: ${err.message}`);
    }
  });

  return { urls, warmed, failed, pagesOk };
}
