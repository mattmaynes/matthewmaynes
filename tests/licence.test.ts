// The root LICENSE is a SPLIT licence (spec 0042): MIT for the software, all
// rights reserved for the content and media. That split is the whole point of the
// file - dropping in a standard whole-repo MIT would licence away the family
// photographs under public/, which is the exact mistake the spec exists to avoid.
//
// Nothing else guards it. A future "tidy up the licence" change could replace the
// file with plain MIT and every other test would stay green, so this asserts the
// structure directly: both halves present, the reserved directories named, and no
// permissive grant over the media.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LICENSE_PATH = join(ROOT, "LICENSE");

test("a root LICENSE exists (Trellis requires one)", () => {
  assert.ok(existsSync(LICENSE_PATH), "expected a LICENSE at the repo root");
});

test("LICENSE keeps the software half and the reserved half separate", () => {
  const text = readFileSync(LICENSE_PATH, "utf8");

  // Half one: a real MIT grant, not a gesture at one.
  assert.match(text, /MIT License/, "expected the software half to be MIT");
  assert.ok(
    text.includes("Permission is hereby granted, free of charge"),
    "expected the actual MIT grant text",
  );

  // Half two: the reservation, and an explicit statement that it is NOT MIT.
  assert.ok(
    text.includes("All rights reserved"),
    "expected the content half to reserve all rights",
  );
  assert.ok(
    text.includes("is NOT covered by the MIT License above"),
    "expected the content half to disclaim the MIT grant explicitly",
  );

  // The reservation must actually name where the media lives, or it is decorative.
  for (const dir of ["content/", "public/", "emails/", "docs/", "brand/"]) {
    assert.ok(
      text.includes(dir),
      `expected the reserved half to name \`${dir}\``,
    );
  }

  // No permissive grant over the media, and no training-data grant.
  assert.ok(
    text.includes("no permission is granted to use it") &&
      text.includes("training data"),
    "expected the reservation to cover reuse AND machine-learning training",
  );

  // A catch-all, so a directory added later defaults to reserved rather than
  // falling through an enumeration gap into the MIT half.
  assert.ok(
    text.includes("anything not clearly inside Section 1 falls under Section 2"),
    "expected a default-to-reserved catch-all",
  );

  // The prose embedded in source files is content, not software. Without this the
  // MIT half would cover the About/Home copy and the resume in src/lib/resume.ts.
  assert.ok(
    text.includes("src/lib/resume.ts") && text.includes("reserved under Section 2"),
    "expected the prose-inside-code carve-out to be stated",
  );
});
