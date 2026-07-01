// Unit tests for the blog loader's pure core (src/lib/blog.js): frontmatter
// parsing, the required-field failure, slugify rules, and the newest-first
// ordering of getAllPosts. No server, no MDX compile - getAllPosts only parses
// frontmatter off the tracked content/blog/*.mdx files. Runs via `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseFrontmatter,
  slugify,
  sortPostsNewestFirst,
  getAllPosts,
  getPostBySlug,
  estimateReadingMinutes,
  isRecent,
  newPostSlug,
} from "../src/lib/blog.js";
import {
  formatPostDate,
  deriveTags,
  resolveActiveTag,
  filterPosts,
} from "../src/lib/blog-view.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const at = (dateStr) => Date.parse(`${dateStr}T00:00:00Z`);

const GOOD = `---
title: A Sample Post
date: 2026-06-30
tags: [Life, Technical]
excerpt: A short teaser.
cover: sample.png
---

Body paragraph one.

More body.
`;

test("parseFrontmatter reads known fields and returns the body", () => {
  const { data, content } = parseFrontmatter(GOOD);
  assert.equal(data.title, "A Sample Post");
  assert.equal(data.date, "2026-06-30");
  assert.deepEqual(data.tags, ["Life", "Technical"]);
  assert.equal(data.excerpt, "A short teaser.");
  assert.equal(data.cover, "sample.png");
  assert.match(content, /Body paragraph one\./);
  // The frontmatter fence itself must be stripped from the body.
  assert.ok(!content.includes("---\ntitle"), "body must not carry the fence");
});

test("parseFrontmatter parses a single-element tag array", () => {
  const { data } = parseFrontmatter(
    "---\ntitle: T\ndate: 2026-01-01\ntags: [Life]\nexcerpt: E\n---\nbody\n",
  );
  assert.deepEqual(data.tags, ["Life"]);
});

test("parseFrontmatter throws when a required field is missing", () => {
  for (const field of ["title", "date", "tags", "excerpt"]) {
    const lines = {
      title: "title: T",
      date: "date: 2026-01-01",
      tags: "tags: [Life]",
      excerpt: "excerpt: E",
    };
    delete lines[field];
    const raw = `---\n${Object.values(lines).join("\n")}\n---\nbody\n`;
    assert.throws(
      () => parseFrontmatter(raw),
      new RegExp(`missing required field: ${field}`, "i"),
      `expected a throw when "${field}" is absent`,
    );
  }
});

test("parseFrontmatter throws on an empty tag array", () => {
  const raw = "---\ntitle: T\ndate: 2026-01-01\ntags: []\nexcerpt: E\n---\nbody\n";
  assert.throws(() => parseFrontmatter(raw), /missing required field: tags/i);
});

test("parseFrontmatter throws when the frontmatter block is missing", () => {
  assert.throws(() => parseFrontmatter("no frontmatter here"), /Missing frontmatter/i);
});

test("slugify lowercases, collapses non-alphanumerics, and trims dashes", () => {
  assert.equal(slugify("I Picked the Wrong Elective"), "i-picked-the-wrong-elective");
  assert.equal(slugify("  Hello, World!  "), "hello-world");
  assert.equal(slugify("Foo   ---   Bar"), "foo-bar");
  assert.equal(slugify("Already-slug"), "already-slug");
  assert.equal(slugify("C++ & Rust"), "c-rust");
});

test("sortPostsNewestFirst orders by date descending without mutating input", () => {
  // A multi-post fixture: the real content dir has one post, so this pure test
  // is what actually guards the comparator (an inverted sort would pass on the
  // single-post getAllPosts check below).
  const input = [
    { slug: "old", date: "2025-01-01" },
    { slug: "newest", date: "2026-06-30" },
    { slug: "mid", date: "2025-12-31" },
  ];
  const out = sortPostsNewestFirst(input);
  assert.deepEqual(
    out.map((p) => p.slug),
    ["newest", "mid", "old"],
    "expected newest-first ordering",
  );
  assert.deepEqual(
    input.map((p) => p.slug),
    ["old", "newest", "mid"],
    "sortPostsNewestFirst must not mutate its input",
  );
});

test("getAllPosts returns posts sorted newest-first", () => {
  const posts = getAllPosts();
  assert.ok(posts.length >= 1, "expected at least the seed post");
  for (let i = 1; i < posts.length; i++) {
    assert.ok(
      posts[i - 1].date >= posts[i].date,
      `expected newest-first order, got ${posts[i - 1].date} before ${posts[i].date}`,
    );
  }
  // Slug is derived from the filename basename.
  const seed = posts.find((p) => p.slug === "i-picked-the-wrong-elective");
  assert.ok(seed, "expected the seed post by its filename slug");
  assert.equal(seed.title, "I Picked the Wrong Elective");
});

test("estimateReadingMinutes counts a multi-paragraph body at ~200 wpm", () => {
  // Three 120-word paragraphs = 360 words; round(360/200) = round(1.8) = 2.
  const para = Array(120).fill("word").join(" ");
  const body = `${para}\n\n${para}\n\n${para}`;
  assert.equal(estimateReadingMinutes(body), 2);
});

test("estimateReadingMinutes floors at 1 minute for a tiny body", () => {
  assert.equal(estimateReadingMinutes("Hi there"), 1);
  assert.equal(estimateReadingMinutes("word"), 1);
});

test("estimateReadingMinutes ignores JSX tags and fenced code as words", () => {
  // 400 words of prose alone -> round(400/200) = 2 minutes.
  const prose = Array(400).fill("word").join(" ");
  // Add a <PostImage> tag and a 500-word code fence: neither is prose, so the
  // estimate must stay 2 (if markup counted, 900/200 -> 5).
  const noisy = [
    prose,
    '<PostImage name="turing-sunrise" />',
    "```js\n" + Array(500).fill("noise").join(" ") + "\n```",
  ].join("\n\n");
  assert.equal(estimateReadingMinutes(noisy), 2);
});

test("isRecent is inclusive at exactly N days and excludes just outside", () => {
  const date = "2026-06-01";
  const base = at(date);
  // Exactly 30 days after publication: still recent (window is inclusive).
  assert.equal(isRecent(date, base + 30 * DAY_MS, 30), true);
  // Just inside the window (29 days): recent.
  assert.equal(isRecent(date, base + 29 * DAY_MS, 30), true);
  // Same day as publication: recent.
  assert.equal(isRecent(date, base, 30), true);
  // Just outside the window (30 days + 1 ms): no longer recent.
  assert.equal(isRecent(date, base + 30 * DAY_MS + 1, 30), false);
  // Far outside: not recent.
  assert.equal(isRecent(date, base + 365 * DAY_MS, 30), false);
});

test("isRecent treats a future-dated post and a bad date as not recent", () => {
  const date = "2026-06-01";
  // now is before the post date (negative age): not recent.
  assert.equal(isRecent(date, at(date) - DAY_MS, 30), false);
  // Unparseable date: not recent (never throws).
  assert.equal(isRecent("not-a-date", at("2026-06-01"), 30), false);
});

test("newPostSlug returns the newest post's slug only while it is recent", () => {
  const posts = [
    { slug: "old", date: "2025-01-01" },
    { slug: "newest", date: "2026-06-30" },
    { slug: "mid", date: "2026-01-15" },
  ];
  const snapshot = posts.map((p) => p.slug);

  // Newest ("newest", 2026-06-30) is 10 days old -> badged.
  assert.equal(newPostSlug(posts, at("2026-07-10"), 30), "newest");
  // Newest is now 100 days old -> no badge (older than the window).
  assert.equal(newPostSlug(posts, at("2026-10-08"), 30), null);
  // Empty input -> null.
  assert.equal(newPostSlug([], at("2026-07-10"), 30), null);
  // Default window is 30 days when omitted (10 days old -> still New).
  assert.equal(newPostSlug(posts, at("2026-07-10")), "newest");

  // A future-dated post (scheduled/typo) must not hide the badge: the newest
  // PUBLISHED post is badged instead of returning null.
  const withFuture = [
    { slug: "future", date: "2027-01-01" },
    { slug: "published", date: "2026-06-30" },
  ];
  assert.equal(newPostSlug(withFuture, at("2026-07-10"), 30), "published");
  // All posts future-dated -> nothing published yet -> null.
  assert.equal(newPostSlug([{ slug: "future", date: "2027-01-01" }], at("2026-07-10"), 30), null);

  // Purity: newPostSlug must not reorder or mutate its input.
  assert.deepEqual(
    posts.map((p) => p.slug),
    snapshot,
    "newPostSlug must not mutate its input array",
  );
});

test("getPostBySlug returns one post with its raw MDX body, or null", () => {
  const post = getPostBySlug("i-picked-the-wrong-elective");
  assert.ok(post, "expected the seed post");
  assert.match(post.content, /accidentally designed a metaphor/);
  assert.equal(getPostBySlug("does-not-exist"), null);
});

// --- blog-view: pure, fs-free listing helpers (tag filter + search) ---------

test("formatPostDate renders a UTC-parsed long date", () => {
  assert.equal(formatPostDate("2026-06-28"), "June 28, 2026");
  // Parsed as UTC midnight, so a negative-offset timezone never shifts the day.
  assert.equal(formatPostDate("2026-01-01"), "January 1, 2026");
});

test("deriveTags is first-appearance order, case-insensitive, non-mutating", () => {
  const posts = [
    { tags: ["Life", "Reflection"] },
    { tags: ["life", "Leadership"] },
    { tags: ["Nature"] },
  ];
  const snapshot = posts.map((p) => [...p.tags]);
  // "life" is a case-insensitive dup of "Life" -> first-seen casing kept, no dup.
  assert.deepEqual(deriveTags(posts), [
    "Life",
    "Reflection",
    "Leadership",
    "Nature",
  ]);
  assert.deepEqual(deriveTags([]), []);
  assert.deepEqual(
    posts.map((p) => p.tags),
    snapshot,
    "deriveTags must not mutate its input",
  );
});

test("resolveActiveTag maps ?tag= to a known tag case-insensitively, else null", () => {
  const tags = ["Life", "Leadership"];
  assert.equal(resolveActiveTag("leadership", tags), "Leadership"); // original casing
  assert.equal(resolveActiveTag("Life", tags), "Life");
  assert.equal(resolveActiveTag("", tags), null); // absent -> All
  assert.equal(resolveActiveTag("nope", tags), null); // unknown -> All
});

test("filterPosts filters by tag and search, composed, non-mutating", () => {
  const posts = [
    { title: "Leading Teams", excerpt: "on management", tags: ["Leadership"] },
    { title: "Planting Trees", excerpt: "five acres", tags: ["Nature", "Life"] },
    { title: "Wrong Elective", excerpt: "a Reflection on choices", tags: ["Life"] },
  ];
  const snapshot = posts.map((p) => p.title);
  const titles = (r) => r.map((p) => p.title);

  // No filter -> everything.
  assert.equal(filterPosts(posts, null, "").length, 3);
  // Tag filter (case-insensitive tag match).
  assert.deepEqual(titles(filterPosts(posts, "life", "")), [
    "Planting Trees",
    "Wrong Elective",
  ]);
  // Search over TITLE.
  assert.deepEqual(titles(filterPosts(posts, null, "leading")), ["Leading Teams"]);
  // Search over EXCERPT.
  assert.deepEqual(titles(filterPosts(posts, null, "five acres")), ["Planting Trees"]);
  // Search over TAGS (case-insensitive).
  assert.deepEqual(titles(filterPosts(posts, null, "leadership")), ["Leading Teams"]);
  // Composition: tag AND query must both match (intersection).
  assert.deepEqual(titles(filterPosts(posts, "Life", "reflection")), ["Wrong Elective"]);
  // No match -> empty array (drives the empty state).
  assert.deepEqual(filterPosts(posts, "Life", "management"), []);
  assert.deepEqual(filterPosts(posts, null, "zzz"), []);

  assert.deepEqual(
    posts.map((p) => p.title),
    snapshot,
    "filterPosts must not mutate its input",
  );
});
