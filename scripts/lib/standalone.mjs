// Assemble the Next.js standalone artifact the way the Dockerfile does: copy
// the build's static assets and the public/ tree next to server.js so the
// running server can serve them. Shared by the resume PDF generator and the
// smoke test so the two cannot drift (review 0006).

import { cpSync } from "node:fs";
import { join } from "node:path";

/**
 * @param {string} root       repo root (where .next and public live)
 * @param {string} targetDir  the standalone dir that holds server.js
 */
export function assembleStandalone(root, targetDir) {
  cpSync(join(root, ".next", "static"), join(targetDir, ".next", "static"), {
    recursive: true,
  });
  cpSync(join(root, "public"), join(targetDir, "public"), {
    recursive: true,
  });
}
