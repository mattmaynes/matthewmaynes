// Lightweight smoke test: boots the production server and asserts every route
// pattern in the site map renders (HTTP 200 + its expected heading text).
// Run via `npm test`. Builds first only if no build is present.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = process.env.SMOKE_PORT ?? "3010";
const BASE = `http://127.0.0.1:${PORT}`;

const routes = [
  { path: "/", expect: "Matthew Maynes" },
  { path: "/about", expect: "About" },
  { path: "/resume", expect: "Resume" },
  { path: "/projects", expect: "Projects" },
  { path: "/blog", expect: "Blog" },
  { path: "/blog/hello-world", expect: "hello-world" },
  { path: "/contact", expect: "Contact" },
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
  test(`GET ${route.path} renders`, async () => {
    const res = await fetch(BASE + route.path);
    assert.equal(res.status, 200, `expected 200 for ${route.path}`);
    const html = await res.text();
    assert.ok(
      html.includes(route.expect),
      `expected ${route.path} to contain "${route.expect}"`,
    );
  });
}
