// Unit tests for the pure JSON-LD builders (src/lib/structured-data.ts). No
// server, no React: each builder returns a plain object, so the schema shapes are
// asserted here directly. The facts come from the real site/identity/resume
// constants, so a builder that dropped a required field, or hardcoded the wrong
// value, reddens. Runs via `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  personJsonLd,
  websiteJsonLd,
  blogJsonLd,
  blogPostingJsonLd,
  breadcrumbListJsonLd,
  countWords,
  toIsoDate,
} from "../src/lib/structured-data.ts";
// Import the asset-free single-source modules (site.ts static-imports images
// Node's test runner cannot load); site.ts re-exports these same values.
import { identity } from "../src/lib/identity.ts";
import { description } from "../src/lib/site-text.ts";
import { resume } from "../src/lib/resume.ts";

// A fixture post (Post-shaped): concrete values so the BlogPosting assertions key
// on data a blank/reverted builder could NOT produce.
const POST = {
  slug: "hello-world",
  title: "Hello World",
  date: "2026-06-28",
  tags: ["Career Reflection", "Engineering"],
  category: "Engineering",
  excerpt: "A first post about building things.",
  content:
    "This is the body. It has some words, `code`, and a [link](https://example.com) plus <PostImage name=\"x\" /> markup that should not count.",
};

test("personJsonLd carries the enriched fields (worksFor, description, knowsAbout)", () => {
  const p = personJsonLd();
  assert.equal(p["@context"], "https://schema.org");
  assert.equal(p["@type"], "Person");
  assert.equal(p.name, identity.name);
  // worksFor comes from the CURRENT role in the resume, not a hardcoded string.
  assert.deepEqual(p.worksFor, {
    "@type": "Organization",
    name: resume.work[0].company,
  });
  assert.equal(p.description, description, "expected the shared site description");
  // knowsAbout is a non-empty array of expertise (drawn from resume.skills).
  assert.ok(Array.isArray(p.knowsAbout), "expected knowsAbout to be an array");
  assert.ok((p.knowsAbout as unknown[]).length > 0, "expected a non-empty knowsAbout");
  // The original identity fields survive the move.
  assert.equal(p.jobTitle, identity.title);
  assert.equal((p.sameAs as unknown[]).length, 3, "expected the three social profiles");
  assert.match(String(p.image), /^https:\/\//, "expected an absolute headshot URL");
});

test("websiteJsonLd is a WebSite attributed to the Person", () => {
  const w = websiteJsonLd();
  assert.equal(w["@context"], "https://schema.org");
  assert.equal(w["@type"], "WebSite");
  assert.equal(w.url, identity.url);
  assert.equal((w.author as Record<string, unknown>)["@type"], "Person");
  assert.equal((w.publisher as Record<string, unknown>).name, identity.name);
});

test("blogJsonLd is a Blog at /blog attributed to the Person", () => {
  const b = blogJsonLd();
  assert.equal(b["@context"], "https://schema.org");
  assert.equal(b["@type"], "Blog");
  assert.match(String(b.url), /\/blog$/, "expected the /blog URL");
  assert.equal((b.author as Record<string, unknown>)["@type"], "Person");
});

test("blogPostingJsonLd carries every required field with the fixture's values", () => {
  const node = blogPostingJsonLd(POST, { minutes: 5 });
  assert.equal(node["@context"], "https://schema.org");
  assert.equal(node["@type"], "BlogPosting");
  assert.equal(node.headline, "Hello World");
  assert.equal(node.description, "A first post about building things.");
  // datePublished/dateModified are the ISO form of the actual post date - a value
  // a reverted builder could not fabricate.
  assert.equal(node.datePublished, "2026-06-28T00:00:00.000Z");
  assert.equal(node.dateModified, "2026-06-28T00:00:00.000Z");
  // author + publisher are the Person.
  assert.equal((node.author as Record<string, unknown>)["@type"], "Person");
  assert.equal((node.publisher as Record<string, unknown>).name, identity.name);
  // image is the post's per-post OG card (absolute).
  assert.match(
    String(node.image),
    /\/blog\/hello-world\/opengraph-image$/,
    "expected the per-post OG card as the image",
  );
  // keywords = tags joined; articleSection = category.
  assert.equal(node.keywords, "Career Reflection, Engineering");
  assert.equal(node.articleSection, "Engineering");
  // mainEntityOfPage + url point at the post's canonical URL.
  assert.match(String(node.url), /\/blog\/hello-world$/);
  assert.equal(
    (node.mainEntityOfPage as Record<string, unknown>)["@id"],
    node.url,
    "expected mainEntityOfPage @id to equal the post URL",
  );
  // wordCount is a positive integer (prose only - markup stripped).
  assert.ok(
    typeof node.wordCount === "number" && node.wordCount > 0,
    "expected a positive wordCount",
  );
  // timeRequired is the ISO 8601 duration for the reading minutes.
  assert.equal(node.timeRequired, "PT5M");
});

test("breadcrumbListJsonLd builds ordered ListItems, terminal crumb name-only", () => {
  const bc = breadcrumbListJsonLd([
    { name: "Home", url: "/" },
    { name: "Blog", url: "/blog" },
    { name: "Hello World" },
  ]);
  assert.equal(bc["@type"], "BreadcrumbList");
  const items = bc.itemListElement as Record<string, unknown>[];
  assert.equal(items.length, 3);
  assert.equal(items[0].position, 1);
  assert.equal(items[0].name, "Home");
  assert.match(String(items[0].item), /^https:\/\/.+\/$/, "expected an absolute Home URL");
  assert.equal(items[2].position, 3);
  assert.equal(items[2].name, "Hello World");
  assert.equal(items[2].item, undefined, "expected the current crumb to omit a URL");
});

test("countWords strips non-prose markup", () => {
  // "This is the body. It has some words, and a link plus markup that should not
  // count." - code span, link URL, and the JSX tag are stripped; the link TEXT is
  // kept. A concrete count guards against a builder that counted raw markup.
  const n = countWords(POST.content);
  assert.ok(n >= 15 && n <= 22, `expected a plausible prose count, got ${n}`);
  assert.equal(countWords("```\ncode\n```"), 0, "fenced code contributes no words");
});

test("toIsoDate throws on an unparseable date", () => {
  assert.throws(() => toIsoDate("not-a-date"), /unparseable/);
});

test("every builder emits @context and @type (well-formed JSON-LD)", () => {
  for (const node of [
    personJsonLd(),
    websiteJsonLd(),
    blogJsonLd(),
    blogPostingJsonLd(POST),
    breadcrumbListJsonLd([{ name: "Home", url: "/" }]),
  ]) {
    assert.ok(node["@context"], "expected an @context");
    assert.ok(node["@type"], "expected an @type");
    // Round-trips through JSON (no undefined/circular that would break the script).
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(node)));
  }
});
