// Generate public/resume.pdf from the actual /resume page, so the page and the
// PDF can never drift. The PDF is rendered by headless Chrome's built-in
// print-to-PDF (no npm browser dependency); the @media print styles and @page
// rules in the app drive the layout.
//
// Two modes:
//   (default)  Regenerate the PDF if the resume sources changed. Rebuilds,
//              boots the standalone server, and drives system Chrome. Run
//              locally and commit the result.
//   --check    Compare the committed hash to the current source hash and exit
//              nonzero if stale. No browser needed - this is what CI runs, so
//              Chrome never enters CI or the Docker image.
//   --force    Regenerate even if the hash matches.
//
// Freshness is keyed on a hash of the resume SOURCE files, not the rendered
// HTML: Next's served HTML embeds per-build asset hashes / RSC payloads and is
// not stable across builds, whereas the sources are. Editing any input below
// makes the committed PDF stale until `npm run resume:pdf` is re-run.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assembleStandalone } from "./lib/standalone.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const PDF_PATH = join(root, "public", "resume.pdf");
const HASH_PATH = join(root, "public", "resume.pdf.hash");

// Everything that determines what the PDF looks like. A change to any of these
// means the committed PDF must be regenerated, so all are folded into the
// freshness hash. This must stay complete: the page renders identity, region,
// and social links from site.ts, so it is an input - omitting it lets the PDF
// drift while --check stays green (review 0007).
const INPUT_FILES = [
  "src/lib/resume.ts",
  "src/lib/site.ts",
  "src/app/resume/page.tsx",
  "src/styles/theme-harbor.css",
  "scripts/generate-resume-pdf.mjs",
];

function sourceHash() {
  const hash = createHash("sha256");
  for (const rel of INPUT_FILES) {
    hash.update(rel);
    hash.update("\0");
    hash.update(readFileSync(join(root, rel)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function fail(message) {
  console.error(`resume:pdf - ${message}`);
  process.exit(1);
}

// --- --check mode: cheap, no browser -------------------------------------
if (process.argv.includes("--check")) {
  const expected = sourceHash();
  if (!existsSync(PDF_PATH) || !existsSync(HASH_PATH)) {
    fail(
      "public/resume.pdf (or its .hash) is missing. Run `npm run resume:pdf` and commit the result.",
    );
  }
  const committed = readFileSync(HASH_PATH, "utf8").trim();
  if (committed !== expected) {
    fail(
      "resume sources changed but public/resume.pdf is stale.\n" +
        "  Run `npm run resume:pdf` and commit public/resume.pdf + public/resume.pdf.hash.",
    );
  }
  console.log("resume:pdf - committed PDF is up to date.");
  process.exit(0);
}

// --- generate mode -------------------------------------------------------
const force = process.argv.includes("--force");
const expected = sourceHash();

if (
  !force &&
  existsSync(PDF_PATH) &&
  existsSync(HASH_PATH) &&
  readFileSync(HASH_PATH, "utf8").trim() === expected
) {
  console.log("resume:pdf - up to date, nothing to regenerate.");
  process.exit(0);
}

// Locate a Chrome/Chromium binary. CHROME_PATH wins; otherwise probe the usual
// install locations on macOS and Linux.
function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  // Fall back to whatever is on PATH (`command -v` is a POSIX shell builtin).
  for (const name of ["google-chrome", "chromium", "chromium-browser"]) {
    const which = spawnSync("command", ["-v", name], { shell: true });
    if (which.status === 0) return which.stdout.toString().trim();
  }
  return null;
}

// Ask the OS for a free port instead of guessing, so a busy port can't turn
// into a silent 60s readiness timeout (review 0007).
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

const chrome = findChrome();
if (!chrome) {
  fail(
    "could not find Chrome/Chromium. Install Chrome or set CHROME_PATH to its binary.",
  );
}

// Always rebuild before rendering: generate mode is only reached when the
// sources changed (or --force), so a leftover standalone build from an earlier
// run would otherwise have Chrome render the OLD page while we write the NEW
// hash - a stale PDF marked fresh (review 0007).
console.log("resume:pdf - building...");
const build = spawnSync("npx", ["next", "build"], { cwd: root, stdio: "inherit" });
if (build.status !== 0) fail("next build failed");

const standaloneDir = join(root, ".next", "standalone");
if (!existsSync(join(standaloneDir, "server.js"))) {
  fail(
    "standalone server.js not found after build (check next.config outputFileTracingRoot).",
  );
}
assembleStandalone(root, standaloneDir);

const PORT = String(await getFreePort());
const BASE = `http://127.0.0.1:${PORT}`;

async function waitForReady(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE + "/resume", { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error("server did not become ready in time");
}

const server = spawn("node", ["server.js"], {
  cwd: standaloneDir,
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT,
  },
});

let exitCode = 0;
try {
  await waitForReady();

  // Headless Chrome prints with @media print active. --virtual-time-budget
  // lets fonts and images settle before the snapshot; --no-pdf-header-footer
  // drops Chrome's default date/URL chrome. --no-sandbox is safe here: this is
  // a local/dev-only tool rendering a trusted 127.0.0.1 URL we just built, and
  // it never runs in CI or the runtime image. The wall-clock `timeout` ensures
  // a hung Chrome can't wedge the build (the spawned server is killed below).
  const args = [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--no-pdf-header-footer",
    "--virtual-time-budget=10000",
    `--print-to-pdf=${PDF_PATH}`,
    `${BASE}/resume`,
  ];
  console.log(`resume:pdf - rendering ${BASE}/resume via ${chrome}`);
  const render = spawnSync(chrome, args, { stdio: "inherit", timeout: 120000 });
  if (render.error) throw render.error;
  if (render.status !== 0 || !existsSync(PDF_PATH)) {
    throw new Error("headless Chrome failed to produce the PDF");
  }

  writeFileSync(HASH_PATH, expected + "\n");
  console.log(`resume:pdf - wrote public/resume.pdf and public/resume.pdf.hash`);
} catch (err) {
  console.error(`resume:pdf - ${err.message}`);
  exitCode = 1;
} finally {
  server.kill("SIGTERM");
}

process.exit(exitCode);
