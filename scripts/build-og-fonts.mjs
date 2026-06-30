// Refresh the OG share-card fonts from the pinned @fontsource/figtree package.
//
// The card is rendered by next/og (satori), which cannot read the woff2 that
// @fontsource-variable ships - but the static @fontsource/figtree package ships
// woff, which satori reads. We copy those woff files (and the OFL license) into
// src/app/_og/ so they are colocated with opengraph-image.tsx and traced into
// the standalone build via `new URL(..., import.meta.url)`.
//
// Deriving from the pinned npm package (not an ad-hoc download) makes the fonts
// reproducible and versioned, and carries the OFL license alongside the binaries
// it covers. Re-run after bumping @fontsource/figtree:
//
//   node scripts/build-og-fonts.mjs

import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = join(root, "node_modules/@fontsource/figtree");
const out = join(root, "src/app/_og");
mkdirSync(out, { recursive: true });

for (const weight of [400, 600, 700]) {
  copyFileSync(
    join(pkg, `files/figtree-latin-${weight}-normal.woff`),
    join(out, `figtree-${weight}.woff`),
  );
}
// OFL-1.1 requires the license to travel with the redistributed font binaries.
copyFileSync(join(pkg, "LICENSE"), join(out, "LICENSE"));

console.log("OG fonts refreshed from @fontsource/figtree into src/app/_og/");
