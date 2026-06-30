// Pre-warm the next/image optimizer cache on a running site so the first visitor
// after a deploy gets cache HITs instead of waiting on encodes. Run by the
// `prewarm` CD job after deploy; also runnable locally against a dev/standalone
// server: `npm run prewarm -- http://127.0.0.1:3000`. (spec 0006)

import { prewarm } from "./lib/prewarm.mjs";

const baseUrl =
  process.argv[2] ||
  process.env.SITE_URL ||
  "https://matthewmaynes.com";

// Only these pages render <Image>; the rest have nothing to warm.
const routes = ["/", "/about", "/projects", "/resume"];

console.log(`Pre-warming next/image cache at ${baseUrl}`);
const started = Date.now();
const { urls, warmed, failed, pagesOk } = await prewarm({
  baseUrl,
  routes,
  log: (msg) => console.log(msg),
});
console.log(
  `Warmed ${warmed}/${urls.length} image variant(s)` +
    (failed ? `, ${failed} failed` : "") +
    ` from ${pagesOk}/${routes.length} page(s) in ${Date.now() - started}ms`,
);

// Best-effort by design: a single image hiccup must never fail an otherwise
// healthy deploy. Only a total failure to reach the site (no page responded) is
// worth a red job - that signals a real connectivity/URL problem.
if (pagesOk === 0) {
  console.error(`Could not reach any page at ${baseUrl} - nothing warmed.`);
  process.exit(1);
}
process.exit(0);
