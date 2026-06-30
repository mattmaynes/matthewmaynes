// Lightweight smoke test: boots the production server and asserts every route
// pattern in the site map renders the RIGHT page (HTTP 200 + its route-unique
// <title> + a rendered <h1> body). We assert the page-unique <title> rather than
// nav/footer text, which appears on every page via the shared layout - otherwise
// a blank or wrong page body would still pass (review feedback 0001). Image-
// bearing routes also assert an inlined blur placeholder so the no-flicker
// treatment can't silently regress (feedback 0005).
// Run via `npm test`. Builds first only if no build is present; CI does a clean
// build, so the stale-artifact risk is limited to manual local re-runs.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assembleStandalone } from "../scripts/lib/standalone.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = process.env.SMOKE_PORT ?? "3010";
const BASE = `http://127.0.0.1:${PORT}`;

// Locate the standalone `server.js`. Normally it sits at the standalone root,
// but inside a nested `.worktrees/<slug>` checkout Next infers the outer repo as
// the workspace root and emits it at `.next/standalone/.worktrees/<slug>/server.js`
// (the two-lockfile quirk - see overview/learnings). Find it either way, skipping
// the unrelated `server.js` files bundled under node_modules.
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

// `title` is the route-unique <title> text (layout template is "%s - Matthew
// Maynes"; home overrides it). Asserting it proves the correct route rendered.
// `contains` are route-unique body substrings that prove the real content
// rendered (not just <head> on an error shell, and not a reverted placeholder).
// `absent` are substrings that must NOT appear (e.g. the "Placeholder" badge on
// a page that has shipped real content) - see feedback 0001/0006.
// `hasBlur` flags routes that render a next/image with placeholder="blur" - the
// server inlines the blurDataURL as a `data:image/...;base64,` value, so its
// presence proves the no-flicker treatment is wired up (feedback 0005).
const routes = [
  { path: "/", title: "Matthew Maynes - Engineering Director", hasBlur: true },
  {
    path: "/about",
    title: "About - Matthew Maynes",
    hasBlur: true,
    contains: ["never stopped building", "The whole crew."],
    absent: ["Placeholder"],
  },
  { path: "/resume", title: "Resume - Matthew Maynes", hasBlur: true },
  { path: "/projects", title: "Projects - Matthew Maynes", hasBlur: true },
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

  // Assemble the standalone artifact exactly as the Dockerfile does, next to the
  // real server.js, then run it so the test exercises the deployed shape. Shares
  // the assembly helper with the resume PDF generator (review 0007).
  const serverDir = dirname(serverJs);
  assembleStandalone(root, serverDir);

  server = spawn("node", ["server.js"], {
    cwd: serverDir,
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

// The resume PDF is a committed static asset under public/, generated from the
// /resume page (npm run resume:pdf). Assert it is served AND is a real,
// non-trivial PDF - status + content-type derive from the .pdf extension alone,
// so a 0-byte or truncated commit would otherwise pass (review 0007).
test("GET /resume.pdf serves a real, non-trivial PDF", async () => {
  const res = await fetch(BASE + "/resume.pdf");
  assert.equal(res.status, 200, "expected 200 for /resume.pdf");
  assert.equal(
    res.headers.get("content-type"),
    "application/pdf",
    "expected /resume.pdf to be served as application/pdf",
  );
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.ok(
    bytes.subarray(0, 5).toString("latin1") === "%PDF-",
    "expected /resume.pdf to begin with the %PDF- magic bytes",
  );
  assert.ok(
    bytes.byteLength > 10_000,
    `expected /resume.pdf to be non-trivial, got ${bytes.byteLength} bytes`,
  );
});

// The /resume page must show the real resume, not the old PagePlaceholder (which
// shared the same <title> + an <h1>, so the generic assertions below can't tell
// them apart - cf. feedback 0001). Also guard the privacy criterion: no contact
// PII in the HTML, which covers the PDF too since it renders from this page.
test("GET /resume renders the real resume with no contact PII", async () => {
  const html = await (await fetch(BASE + "/resume")).text();
  for (const marker of ["How I Lead", "Work History", "Certifications"]) {
    assert.ok(html.includes(marker), `expected /resume to render "${marker}"`);
  }
  assert.ok(
    !html.includes("Placeholder"),
    "expected /resume to have dropped the PagePlaceholder badge",
  );
  // Privacy: the public page must not leak an email, a phone number, or the
  // postal code from the private resume source (spec 0005).
  assert.doesNotMatch(
    html,
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
    "expected /resume to contain no email address",
  );
  assert.doesNotMatch(
    html,
    /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/,
    "expected /resume to contain no phone number",
  );
  assert.doesNotMatch(
    html,
    /\bK0K\s?3E0\b/i,
    "expected /resume to contain no postal code",
  );
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
    // Route-unique body content: proves the real page rendered, so a blank body
    // or a reverted placeholder can't pass on the shared <h1> alone.
    for (const needle of route.contains ?? []) {
      assert.ok(
        html.includes(needle),
        `expected ${route.path} body to contain "${needle}"`,
      );
    }
    for (const needle of route.absent ?? []) {
      assert.ok(
        !html.includes(needle),
        `expected ${route.path} body to NOT contain "${needle}"`,
      );
    }
    // Image-bearing routes inline a blur placeholder; its absence means the
    // no-flicker treatment regressed to a bare <Image> (feedback 0005).
    if (route.hasBlur) {
      assert.match(
        html,
        /data:image\/[a-z]+;base64,/,
        `expected ${route.path} to inline a blur placeholder (placeholder="blur")`,
      );
    }
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
