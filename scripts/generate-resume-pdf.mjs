// Generate public/resume.pdf from the actual /resume page, so the page and the
// PDF can never drift. The PDF is rendered by headless Chrome's built-in
// print-to-PDF (no npm browser dependency); the @media print styles and @page
// rules in the app drive the layout.
//
// Two modes:
//   (default)  Regenerate the PDF if the resume sources changed. Boots the
//              standalone server and drives system Chrome. Run locally and
//              commit the result.
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
import {
  createHash,
  randomInt,
} from "node:crypto";
import {
  cpSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const PDF_PATH = join(root, "public", "resume.pdf");
const HASH_PATH = join(root, "public", "resume.pdf.hash");

// Files whose contents determine what the PDF looks like. A change to any of
// these means the committed PDF must be regenerated.
const INPUT_FILES = [
  "src/lib/resume.ts",
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
  // Fall back to whatever is on PATH.
  for (const name of ["google-chrome", "chromium", "chromium-browser"]) {
    const which = spawnSync("command", ["-v", name], { shell: true });
    if (which.status === 0) return which.stdout.toString().trim();
  }
  return null;
}

const chrome = findChrome();
if (!chrome) {
  fail(
    "could not find Chrome/Chromium. Install Chrome or set CHROME_PATH to its binary.",
  );
}

// Ensure a standalone build exists; build once if missing.
const standaloneDir = join(root, ".next", "standalone");
if (!existsSync(join(standaloneDir, "server.js"))) {
  console.log("resume:pdf - no standalone build found, running next build...");
  const build = spawnSync("npx", ["next", "build"], {
    cwd: root,
    stdio: "inherit",
  });
  if (build.status !== 0) fail("next build failed");
}

// Assemble the standalone artifact exactly like the Dockerfile / smoke test,
// so server.js can serve static assets and images while Chrome renders.
cpSync(join(root, ".next", "static"), join(standaloneDir, ".next", "static"), {
  recursive: true,
});
cpSync(join(root, "public"), join(standaloneDir, "public"), {
  recursive: true,
});

const PORT = String(randomInt(20000, 60000));
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
  // drops Chrome's default date/URL chrome.
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
  const render = spawnSync(chrome, args, { stdio: "inherit" });
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
