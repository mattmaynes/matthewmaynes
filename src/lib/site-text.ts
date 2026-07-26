/**
 * The site's shared TEXT constants - tagline, description, and share-card alt -
 * split out from `site.ts` so an asset-free consumer can read them under
 * `node --test`. `site.ts` static-imports the staged images (`.jpg`/`.png`),
 * which Node's test runner cannot load, so any pure builder that needs the
 * description (e.g. `structured-data.ts`) reads it HERE instead of from `site.ts`.
 * `site.ts` re-exports these into the `site` object, so there is still ONE source
 * - the rendered pages and the JSON-LD builders can never drift.
 *
 * No PII, no imports: safe to load anywhere.
 */

/** Human-facing tagline shown on the hero. */
export const tagline =
  "An endlessly curious problem solver who can't help but build things";

/** One shared description: the <meta>, Open Graph, Twitter card, manifest, and
 *  the JSON-LD nodes all read this so the link preview, search snippet, install
 *  prompt, and structured data never drift. */
export const description =
  "Personal site of Matthew Maynes, an engineering leader who builds things, plants trees, and leads by example.";

/** Alt text for the generated share card (opengraph-image). */
export const ogImageAlt = "Matthew Maynes - Engineering Director";

/** The site's headshot as a public path (served from `public/images/`). Used by
 *  the Person JSON-LD, which cannot depend on the hashed static import (that pulls
 *  a binary asset into an otherwise pure, unit-testable module). */
export const headshotPath = "/images/headshot.jpg";
