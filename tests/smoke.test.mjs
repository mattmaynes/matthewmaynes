// Lightweight smoke test: boots the production server and asserts every route
// pattern in the site map renders the RIGHT page (HTTP 200 + its route-unique
// <title> + a rendered <h1> body). We assert the page-unique <title> rather than
// nav/footer text, which appears on every page via the shared layout - otherwise
// a blank or wrong page body would still pass (review feedback 0001).
// Run via `npm test`. Builds first only if no build is present; CI does a clean
// build, so the stale-artifact risk is limited to manual local re-runs.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = process.env.SMOKE_PORT ?? "3010";
const BASE = `http://127.0.0.1:${PORT}`;

// `title` is the route-unique <title> text (layout template is "%s - Matthew
// Maynes"; home overrides it). Asserting it proves the correct route rendered.
const routes = [
  { path: "/", title: "Matthew Maynes - Engineering Director" },
  { path: "/about", title: "About - Matthew Maynes" },
  { path: "/resume", title: "Resume - Matthew Maynes" },
  { path: "/projects", title: "Projects - Matthew Maynes" },
  { path: "/blog", title: "Blog - Matthew Maynes" },
  { path: "/blog/hello-world", title: "hello-world - Blog - Matthew Maynes" },
  { path: "/contact", title: "Contact - Matthew Maynes" },
];

let server;

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

before(async () => {
  const standaloneDir = join(root, ".next", "standalone");
  if (!existsSync(join(standaloneDir, "server.js"))) {
    const build = spawnSync("npx", ["next", "build"], {
      cwd: root,
      stdio: "inherit",
    });
    if (build.status !== 0) throw new Error("next build failed");
  }

  // Assemble the standalone artifact exactly as the Dockerfile does, then run
  // the real server.js so the test exercises the deployed shape of the app.
  cpSync(join(root, ".next", "static"), join(standaloneDir, ".next", "static"), {
    recursive: true,
  });
  cpSync(join(root, "public"), join(standaloneDir, "public"), {
    recursive: true,
  });

  server = spawn("node", ["server.js"], {
    cwd: standaloneDir,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT,
    },
  });
  await waitForReady();
});

after(() => {
  if (server) server.kill("SIGTERM");
});

for (const route of routes) {
  test(`GET ${route.path} renders the right page`, async () => {
    const res = await fetch(BASE + route.path);
    assert.equal(res.status, 200, `expected 200 for ${route.path}`);
    const html = await res.text();
    // Route-unique title: proves this exact route's metadata rendered.
    assert.ok(
      html.includes(`<title>${route.title}</title>`),
      `expected ${route.path} to render <title>${route.title}</title>`,
    );
    // Body actually rendered (not just <head> on an error shell).
    assert.match(
      html,
      /<h1[\s>]/,
      `expected ${route.path} to render an <h1>`,
    );
  });
}

// SEO + sharing surface (spec 0004). One fetch of the home page <head>, then
// assertions on the social/discovery tags and the routes they reference.
test("home page exposes the sharing + SEO metadata", async () => {
  const html = await (await fetch(BASE + "/")).text();

  // Favicon link (Next emits one for app/icon.png and/or favicon.ico).
  assert.match(html, /<link[^>]+rel="icon"/, "expected a favicon <link>");

  // Open Graph + Twitter card.
  const ogImage = html.match(
    /<meta\s+property="og:image"\s+content="([^"]+)"/,
  );
  assert.ok(ogImage, "expected an og:image meta tag");
  assert.match(html, /<meta\s+property="og:title"/, "expected og:title");
  assert.match(
    html,
    /<meta\s+name="twitter:card"\s+content="summary_large_image"/,
    "expected a summary_large_image twitter card",
  );

  // JSON-LD Person block.
  assert.match(
    html,
    /<script type="application\/ld\+json">[^<]*"@type":"Person"/,
    "expected a Person JSON-LD block",
  );

  // The generated OG image renders (catches font/logo load failures). The meta
  // URL is absolute against metadataBase, so fetch its path on the test server.
  const ogPath = new URL(ogImage[1]).pathname + new URL(ogImage[1]).search;
  const ogRes = await fetch(BASE + ogPath);
  assert.equal(ogRes.status, 200, "expected the og image route to 200");
  assert.match(
    ogRes.headers.get("content-type") ?? "",
    /image\/png/,
    "expected the og image to be a PNG",
  );
});

test("robots, sitemap, and manifest are served", async () => {
  const robots = await fetch(BASE + "/robots.txt");
  assert.equal(robots.status, 200, "expected /robots.txt to 200");
  assert.match(
    await robots.text(),
    /Sitemap:/i,
    "expected robots.txt to reference the sitemap",
  );

  const sitemap = await fetch(BASE + "/sitemap.xml");
  assert.equal(sitemap.status, 200, "expected /sitemap.xml to 200");
  assert.match(
    await sitemap.text(),
    /<loc>/,
    "expected sitemap.xml to list URLs",
  );

  const manifest = await fetch(BASE + "/manifest.webmanifest");
  assert.equal(manifest.status, 200, "expected the manifest to 200");
  const json = await manifest.json();
  assert.ok(
    Array.isArray(json.icons) && json.icons.length >= 2,
    "expected the manifest to declare install icons",
  );
});
