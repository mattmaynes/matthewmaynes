// Regenerate the favicon / app-icon set from the brand master.
//
// Source of truth: public/brand/logo-m.png (600x600, transparent corners).
// Dependency-free: macOS `sips` resizes, Node stdlib packs the multi-res ICO
// (PNG-payload ICO, supported by every modern browser). No ImageMagick, no npm
// dependency, so the icons are reproducible from one command:
//
//   node scripts/build-icons.ts
//
// Outputs (committed, do not hand-edit):
//   src/app/favicon.ico    - 16/32/48 multi-res, legacy + scraper fallback
//   src/app/icon.png       - 512, modern PNG favicon (Next links it)
//   src/app/apple-icon.png - 180, iOS home-screen tile
//   public/icon-192.png    - manifest icon
//   public/icon-512.png    - manifest icon / PWA install

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const master = join(root, "public/brand/logo-m.png");

// `-Z N` fits the image within an NxN box, preserving the square aspect ratio.
function resize(size: number, out: string): void {
  execFileSync(
    "sips",
    ["-s", "format", "png", "-Z", String(size), master, "--out", out],
    { stdio: "ignore" },
  );
}

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

console.log("Icons regenerated from public/brand/logo-m.png");
