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

// A share-card/icon URL may be absolute against metadataBase (the production
// host) or root-relative; either way, fetch only its path/query on the local
// test server. Resolving against BASE normalizes both forms.
async function fetchLocal(url) {
  const u = new URL(url, BASE);
  return fetch(BASE + u.pathname + u.search);
}

async function assertIsImage(res, where) {
  assert.equal(res.status, 200, `expected 200 for ${where}`);
  assert.match(
    res.headers.get("content-type") ?? "",
    /^image\//,
    `expected ${where} to be an image`,
  );
}

// SEO + sharing surface (spec 0004). One fetch of the home page <head>, then
// assertions on the social/discovery tags and the routes/assets they reference -
// each asset is actually fetched, so a missing or broken file fails the suite.
test("home page exposes the sharing + SEO metadata", async () => {
  const html = await (await fetch(BASE + "/")).text();

  // Favicon link, and the icon it points at actually resolves to an image.
  const iconLink = html.match(/<link[^>]+rel="icon"[^>]*href="([^"]+)"/);
  assert.ok(iconLink, "expected a favicon <link> with an href");
  await assertIsImage(await fetchLocal(iconLink[1]), "the favicon");

  // Open Graph image: present, and it renders (catches font/logo load failures).
  const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
  assert.ok(ogImage, "expected an og:image meta tag");
  assert.match(html, /<meta\s+property="og:title"/, "expected og:title");
  await assertIsImage(await fetchLocal(ogImage[1]), "the og:image");

  // Twitter large card: the card type, plus the image (twitter-image re-export)
  // renders - a broken re-export would silently break the X preview otherwise.
  assert.match(
    html,
    /<meta\s+name="twitter:card"\s+content="summary_large_image"/,
    "expected a summary_large_image twitter card",
  );
  const twImage = html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/);
  assert.ok(twImage, "expected a twitter:image meta tag");
  await assertIsImage(await fetchLocal(twImage[1]), "the twitter:image");

  // JSON-LD: parse it (not just substring-match) and check the identity shape.
  const ld = html.match(
    /<script type="application\/ld\+json">(.*?)<\/script>/s,
  );
  assert.ok(ld, "expected a JSON-LD script block");
  const person = JSON.parse(ld[1]);
  assert.equal(person["@type"], "Person", "expected a Person JSON-LD type");
  assert.equal(
    person.sameAs?.length,
    3,
    "expected sameAs to list the three social profiles",
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

  // Every nav route should be listed (6 of them), not just one <loc>.
  const sitemap = await fetch(BASE + "/sitemap.xml");
  assert.equal(sitemap.status, 200, "expected /sitemap.xml to 200");
  const sitemapXml = await sitemap.text();
  const locs = sitemapXml.match(/<loc>/g) ?? [];
  assert.ok(
    locs.length >= 6,
    `expected sitemap.xml to list all nav routes, saw ${locs.length}`,
  );
  assert.match(sitemapXml, /matthewmaynes\.com/, "expected canonical host URLs");

  // Manifest is valid JSON and its declared install icons actually resolve.
  const manifest = await fetch(BASE + "/manifest.webmanifest");
  assert.equal(manifest.status, 200, "expected the manifest to 200");
  const json = await manifest.json();
  assert.ok(
    Array.isArray(json.icons) && json.icons.length >= 2,
    "expected the manifest to declare install icons",
  );
  for (const icon of json.icons) {
    await assertIsImage(await fetchLocal(icon.src), `manifest icon ${icon.src}`);
  }
});
