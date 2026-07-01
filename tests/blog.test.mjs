// Unit tests for the blog loader's pure core (src/lib/blog.js): frontmatter
// parsing, the required-field failure, slugify rules, and the newest-first
// ordering of getAllPosts. No server, no MDX compile - getAllPosts only parses
// frontmatter off the tracked content/blog/*.mdx files. Runs via `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseFrontmatter,
  slugify,
  getAllPosts,
  getPostBySlug,
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

test("getPostBySlug returns one post with its raw MDX body, or null", () => {
  const post = getPostBySlug("i-picked-the-wrong-elective");
  assert.ok(post, "expected the seed post");
  assert.match(post.content, /accidentally designed a metaphor/);
  assert.equal(getPostBySlug("does-not-exist"), null);
});
