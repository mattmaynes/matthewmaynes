// Tests for the next/image cache pre-warmer (spec 0006). Two layers:
// 1. Pure unit tests for extractImageUrls - the risky regex/parse seam.
// 2. An integration test that boots the standalone server, runs prewarm against
//    it, and asserts a sampled image flips from X-Nextjs-Cache MISS to HIT - the
//    behavior the CD job depends on.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assembleStandalone } from "../scripts/lib/standalone.mjs";
import { extractImageUrls, prewarm } from "../scripts/lib/prewarm.mjs";

// --- unit: extractImageUrls ------------------------------------------------

test("extractImageUrls pulls src + every srcset width, deduped and decoded", () => {
  const html = `
    <img
      src="/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fa.jpg&amp;w=640&amp;q=75"
      srcset="/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fa.jpg&amp;w=640&amp;q=75 640w,
              /_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fa.jpg&amp;w=1080&amp;q=75 1080w" />
    <img src="/_next/image?url=%2F_next%2Fstatic%2Fmedia%2Fb.jpg&amp;w=384&amp;q=75" />`;
  const urls = extractImageUrls(html, "https://example.com");

  // a@640 appears in both src and srcset -> deduped to one; a@1080 and b@384.
  assert.equal(urls.length, 3, `expected 3 unique URLs, got ${urls.length}`);
  assert.ok(
    urls.every((u) => u.startsWith("https://example.com/_next/image?")),
    "expected absolute URLs against the origin",
  );
  assert.ok(
    urls.every((u) => !u.includes("&amp;")),
    "expected &amp; to be decoded to &",
  );
  assert.ok(
    urls.some((u) => u.includes("w=640")) &&
      urls.some((u) => u.includes("w=1080")) &&
      urls.some((u) => u.includes("w=384")),
    "expected all three widths present",
  );
  // No width descriptor or comma leaked into a URL.
  assert.ok(
    urls.every((u) => !/\s|,$/.test(u)),
    "expected no trailing descriptor/comma in URLs",
  );
});

test("extractImageUrls ignores non-image URLs and returns [] for none", () => {
  const html = `<a href="/_next/static/chunks/main.js"></a><img src="/logo.svg">`;
  assert.deepEqual(extractImageUrls(html, "https://example.com"), []);
});

test("prewarm reports failures without throwing when the site is unreachable", async () => {
  // A fetchImpl that always rejects: pages fail, nothing warms, no throw.
  const result = await prewarm({
    baseUrl: "http://127.0.0.1:1/",
    routes: ["/"],
    fetchImpl: async () => {
      throw new Error("ECONNREFUSED");
    },
  });
  assert.deepEqual(result, { urls: [], warmed: 0, failed: 0, pagesOk: 0 });
});

// --- integration: warm a real standalone server ----------------------------

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = process.env.PREWARM_TEST_PORT ?? "3014";
const BASE = `http://127.0.0.1:${PORT}`;

function findServerJs(dir) {
  const direct = join(dir, "server.js");
  if (existsSync(direct)) return direct;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (e.name === "node_modules") continue;
        stack.push(join(cur, e.name));
      } else if (e.name === "server.js") {
        return join(cur, e.name);
      }
    }
  }
  return null;
}

async function waitForReady(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE + "/", { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not become ready in time");
}

let server;

before(async () => {
  const standaloneDir = join(root, ".next", "standalone");
  let serverJs = findServerJs(standaloneDir);
  if (!serverJs) {
    const build = spawnSync("npx", ["next", "build"], {
      cwd: root,
      stdio: "inherit",
    });
    if (build.status !== 0) throw new Error("next build failed");
    serverJs = findServerJs(standaloneDir);
    if (!serverJs) throw new Error("standalone server.js not found after build");
  }
  const serverDir = dirname(serverJs);
  assembleStandalone(root, serverDir);
  server = spawn("node", ["server.js"], {
    cwd: serverDir,
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT },
  });
  await waitForReady();
});

after(() => {
  if (server) server.kill("SIGTERM");
});

test("prewarm warms the home page images and flips MISS -> HIT", async () => {
  // Sample a hero image URL before warming: a fresh server reports a cache MISS.
  const html = await (await fetch(BASE + "/")).text();
  const [sample] = extractImageUrls(html, BASE);
  assert.ok(sample, "expected at least one /_next/image URL on the home page");

  const cold = await fetch(sample, {
    headers: { accept: "image/avif,image/webp,*/*" },
  });
  await cold.arrayBuffer();
  assert.equal(
    cold.headers.get("x-nextjs-cache"),
    "MISS",
    "expected a cold image request to MISS before warming",
  );

  // Warm a DIFFERENT, not-yet-requested page so the assertion below proves the
  // warmer (not the line above) populated the cache.
  const { warmed, urls, pagesOk } = await prewarm({
    baseUrl: BASE,
    routes: ["/about"],
  });
  assert.ok(pagesOk === 1, "expected the /about page to be crawled");
  assert.ok(warmed > 0, `expected to warm at least one image, got ${warmed}`);

  const warmedUrl = urls[0];
  const hit = await fetch(warmedUrl, {
    headers: { accept: "image/avif,image/webp,*/*" },
  });
  await hit.arrayBuffer();
  assert.equal(
    hit.headers.get("x-nextjs-cache"),
    "HIT",
    "expected a warmed image to HIT on the next request",
  );
});
