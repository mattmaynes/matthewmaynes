// Regenerate the favicon / app-icon set from the brand master.
//
// Single source of truth: public/brand/logo-m.svg (the node-graph "M", Harbor
// palette). Everything else is derived - the script renders the 1024 raster
// master (public/brand/logo-m.png) from it with Quick Look, then fans that out
// to every size. Editing the mark is therefore edit the SVG, run this script;
// there is no manual render step to forget, and no way to ship a vector favicon
// that disagrees with the rasters.
// Dependency-free: macOS `qlmanage` renders, `sips` resizes, Node stdlib packs
// the multi-res ICO (PNG-payload ICO, supported by every modern browser). No
// ImageMagick, no npm dependency, so the icons are reproducible from one command:
//
//   node scripts/build-icons.ts           Regenerate every output below.
//   node scripts/build-icons.ts --check   Fail if icon.svg drifted from the source.
//
// `--check` is a byte compare only - no macOS tooling - so CI (ubuntu) can run
// it to catch an SVG edit that was never regenerated, the same freshness guard
// `resume:pdf:check` and `privacy:check` apply to their generated artifacts.
//
// Outputs (committed, do not hand-edit):
//   public/brand/logo-m.png - 1024 raster master, rendered from the SVG
//   src/app/favicon.ico     - 16/32/48 multi-res, legacy + scraper fallback
//   src/app/icon.svg        - vector favicon, copied straight from the SVG source
//   src/app/icon.png        - 512, modern PNG favicon (Next links it)
//   src/app/apple-icon.png  - 180, iOS home-screen tile
//   public/icon-192.png     - manifest icon
//   public/icon-512.png     - manifest icon / PWA install

import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const master = join(root, "public/brand/logo-m.png");
const vector = join(root, "public/brand/logo-m.svg");
const iconSvg = join(root, "src/app/icon.svg");

// --- --check mode: cheap, compare only (used by CI) ------------------------
if (process.argv.includes("--check")) {
  const source = readFileSync(vector);
  let shipped: Buffer;
  try {
    shipped = readFileSync(iconSvg);
  } catch {
    fail("src/app/icon.svg is missing.");
  }
  if (!source.equals(shipped!)) {
    fail("src/app/icon.svg no longer matches public/brand/logo-m.svg.");
  }
  console.log("icon.svg matches the vector source.");
  process.exit(0);
}

function fail(message: string): never {
  console.error(`${message} Run \`npm run icons\` and commit the result.`);
  process.exit(1);
}

// The vector favicon is the SVG source itself - no render step, so it stays
// pixel-perfect at whatever size a tab, bookmark bar, or history row asks for.
// Browsers without SVG-favicon support fall back to the rasters below.
//
// It is served verbatim from the site origin at /icon.svg, so assert it is
// inert before copying: an SVG is a document, and script / external references
// smuggled into the brand file would otherwise ship as first-party content.
function assertInert(svg: string): void {
  const banned =
    /<script|<foreignObject|<use\b|<image\b|<!ENTITY|\son\w+\s*=|href\s*=|data:/i;
  const match = svg.match(banned);
  if (match) {
    console.error(
      `${basename(vector)} contains "${match[0]}", which is not inert. The ` +
        "vector favicon is served from the site origin, so it must be plain " +
        "shapes: no script, external references, or event handlers.",
    );
    process.exit(1);
  }
}

assertInert(readFileSync(vector, "utf8"));

// Render the raster master from the vector with Quick Look. `-t` writes a
// thumbnail named <source>.png into the output directory.
const render = mkdtempSync(join(tmpdir(), "logo-"));
try {
  execFileSync("qlmanage", ["-t", "-s", "1024", "-o", render, vector], {
    stdio: "ignore",
  });
  copyFileSync(join(render, `${basename(vector)}.png`), master);
} finally {
  rmSync(render, { recursive: true, force: true });
}

// `-Z N` fits the image within an NxN box, preserving the square aspect ratio.
function resize(size: number, out: string): void {
  execFileSync(
    "sips",
    ["-s", "format", "png", "-Z", String(size), master, "--out", out],
    { stdio: "ignore" },
  );
}

copyFileSync(vector, iconSvg);
resize(512, join(root, "src/app/icon.png"));
resize(180, join(root, "src/app/apple-icon.png"));
resize(192, join(root, "public/icon-192.png"));
resize(512, join(root, "public/icon-512.png"));

// favicon.ico: pack PNG-encoded 16/32/48 frames into one ICO container.
const tmp = mkdtempSync(join(tmpdir(), "ico-"));
try {
  const frames = [16, 32, 48].map((size) => {
    const p = join(tmp, `${size}.png`);
    resize(size, p);
    return { size, buf: readFileSync(p) };
  });
  writeFileSync(join(root, "src/app/favicon.ico"), buildIco(frames));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// ICO = ICONDIR header (6 bytes) + one ICONDIRENTRY (16 bytes) per frame +
// the raw PNG bodies. width/height of 0 encode 256; ours are all < 256.
function buildIco(frames: { size: number; buf: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(frames.length, 4);

  const entries = Buffer.alloc(16 * frames.length);
  const bodies: Buffer[] = [];
  let offset = header.length + entries.length;

  frames.forEach((frame, i) => {
    const e = i * 16;
    entries.writeUInt8(frame.size >= 256 ? 0 : frame.size, e + 0); // width
    entries.writeUInt8(frame.size >= 256 ? 0 : frame.size, e + 1); // height
    entries.writeUInt8(0, e + 2); // palette count (0 = no palette)
    entries.writeUInt8(0, e + 3); // reserved
    entries.writeUInt16LE(1, e + 4); // color planes
    entries.writeUInt16LE(32, e + 6); // bits per pixel
    entries.writeUInt32LE(frame.buf.length, e + 8); // body size
    entries.writeUInt32LE(offset, e + 12); // body offset
    offset += frame.buf.length;
    bodies.push(frame.buf);
  });

  return Buffer.concat([header, entries, ...bodies]);
}

console.log("Icons regenerated from public/brand/logo-m.svg");
