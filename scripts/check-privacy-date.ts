// Enforce that the privacy policy's "Last updated" date is stamped whenever the
// policy's CONTENT changes - the same freshness contract as the resume PDF hash
// (scripts/generate-resume-pdf.ts, verify.yml). The hash is keyed on the privacy
// page with the "Last updated" date VALUE normalized out, so a pure date bump does
// not move the hash and any other content edit does.
//
// CI runs `--check` (compare only, no writes); a human/agent runs the default
// (stamp) after editing the policy to set the date to today and rewrite the hash.
//
// Usage:
//   node scripts/check-privacy-date.ts           Stamp: set the date to today, rewrite the hash.
//   node scripts/check-privacy-date.ts --check    Fail if the content changed but was not stamped.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE_PATH = join(root, "src", "app", "privacy", "page.tsx");
const HASH_PATH = join(root, "src", "app", "privacy", "content.hash");

// The "Last updated: <date>" line. `[^<]+` stops at the closing tag, so it captures
// only the date text. Group 1 is the label (kept), group 2 is the date (replaced).
const DATE_RE = /(Last updated:\s*)([^<]+)/;

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

if (!existsSync(PAGE_PATH)) fail(`privacy page not found at ${PAGE_PATH}`);
const page = readFileSync(PAGE_PATH, "utf8");
if (!DATE_RE.test(page)) fail('privacy page has no "Last updated:" line to stamp.');

// Hash the page with the date VALUE normalized to a constant, so the hash tracks
// the policy content and ignores the date itself.
function contentHash(src: string): string {
  const normalized = src.replace(DATE_RE, "$1<DATE>");
  return createHash("sha256").update(normalized).digest("hex");
}

const current = contentHash(page);

// --- --check mode: cheap, compare only (used by CI) ------------------------
if (process.argv.includes("--check")) {
  if (!existsSync(HASH_PATH))
    fail(
      "src/app/privacy/content.hash is missing. Run `npm run privacy:stamp` and commit it.",
    );
  const committed = readFileSync(HASH_PATH, "utf8").trim();
  if (committed !== current)
    fail(
      'The privacy policy content changed but its "Last updated" date was not stamped.\n' +
        "  Run `npm run privacy:stamp` and commit src/app/privacy/page.tsx + src/app/privacy/content.hash.",
    );
  console.log("privacy: content hash matches - the date is stamped.");
  process.exit(0);
}

// --- stamp mode (default): set the date to today, rewrite the hash ---------
// A normal Node script (not the Workflow sandbox), so `new Date()` is available.
const today = new Date().toLocaleDateString("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "America/Toronto",
});
const stamped = page.replace(DATE_RE, `$1${today}`);
writeFileSync(PAGE_PATH, stamped);
writeFileSync(HASH_PATH, `${contentHash(stamped)}\n`);
console.log(`privacy: stamped "Last updated: ${today}" and refreshed content.hash.`);
