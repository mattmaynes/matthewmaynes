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
  // warmer (not the cold check above) populated the cache.
  const { warmed, failed, urls, pagesOk } = await prewarm({
    baseUrl: BASE,
    routes: ["/about"],
  });
  assert.equal(pagesOk, 1, "expected the /about page to be crawled");
  assert.ok(urls.length > 1, "expected /about to render several image variants");
  // Spec: warm EVERY variant. A regression that warms only the first would pass
  // a bare `warmed > 0`, so assert the full set succeeded.
  assert.equal(failed, 0, "expected no image to fail warming");
  assert.equal(
    warmed,
    urls.length,
    `expected all ${urls.length} variants warmed, got ${warmed}`,
  );

  // Assert HIT on a URL the cold check above did NOT touch, so the HIT can only
  // come from the warmer - not a self-inflicted warm of the shared headshot URL.
  const warmedUrl = urls.find((u) => u !== sample);
  assert.ok(warmedUrl, "expected a warmed URL distinct from the cold sample");
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

// The entry script's exit code is the CD gate (acceptance #3): exit 1 only on
// wholesale failure, exit 0 otherwise. Drive the real script both ways.
test("entry script exits 1 when the site is unreachable", () => {
  const res = spawnSync(
    "node",
    [join(root, "scripts/prewarm-images.mjs"), "http://127.0.0.1:1/"],
    { encoding: "utf8" },
  );
  assert.equal(res.status, 1, "expected exit 1 when no page responds");
});

test("entry script exits 0 and warms against a healthy server", () => {
  const res = spawnSync(
    "node",
    [join(root, "scripts/prewarm-images.mjs"), BASE],
    { encoding: "utf8" },
  );
  assert.equal(res.status, 0, `expected exit 0, got ${res.status}`);
  assert.match(
    res.stdout,
    /Warmed \d+\/\d+ image variant/,
    "expected the script to report what it warmed",
  );
});
