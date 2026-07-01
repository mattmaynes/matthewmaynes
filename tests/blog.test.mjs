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
} from "../src/lib/blog.js";

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

test("getPostBySlug returns one post with its raw MDX body, or null", () => {
  const post = getPostBySlug("i-picked-the-wrong-elective");
  assert.ok(post, "expected the seed post");
  assert.match(post.content, /accidentally designed a metaphor/);
  assert.equal(getPostBySlug("does-not-exist"), null);
});
