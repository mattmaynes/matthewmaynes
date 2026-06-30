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
import { cpSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

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
// `hasBlur` flags routes that render a next/image with placeholder="blur" - the
// server inlines the blurDataURL as a `data:image/...;base64,` value, so its
// presence proves the no-flicker treatment is wired up (feedback 0005).
const routes = [
  { path: "/", title: "Matthew Maynes - Engineering Director", hasBlur: true },
  { path: "/about", title: "About - Matthew Maynes", hasBlur: true },
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
  // real server.js, then run it so the test exercises the deployed shape.
  const serverDir = dirname(serverJs);
  cpSync(join(root, ".next", "static"), join(serverDir, ".next", "static"), {
    recursive: true,
  });
  cpSync(join(root, "public"), join(serverDir, "public"), {
    recursive: true,
  });

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
// so a 0-byte or truncated commit would otherwise pass (review 0006).
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
