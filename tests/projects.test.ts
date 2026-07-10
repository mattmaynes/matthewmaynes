// Unit tests for the projects loader's pure core: the fs-free view helpers
// (category order, within-section sort, grouping) and the frontmatter parser
// (field parsing, required-field failure, unknown-category failure). Also a
// light integration pass over the real content/projects/*.mdx via getAllProjects.
// No server, no MDX compile. Runs via `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIES,
  groupByCategory,
  isProjectCategory,
  slugify,
  sortByOrder,
  type ProjectCategory,
} from "../src/lib/projects-view.ts";
import { getAllProjects, parseProjectFrontmatter } from "../src/lib/projects.ts";

test("CATEGORIES is the fixed Work -> Tinkering -> Making order", () => {
  assert.deepEqual(
    CATEGORIES.map((c) => c.key),
    ["work", "tinkering", "making"],
  );
  assert.deepEqual(
    CATEGORIES.map((c) => c.label),
    ["Work", "Tinkering", "Making"],
  );
});

test("isProjectCategory accepts the three keys and rejects others", () => {
  assert.ok(isProjectCategory("work"));
  assert.ok(isProjectCategory("tinkering"));
  assert.ok(isProjectCategory("making"));
  assert.ok(!isProjectCategory("Work"));
  assert.ok(!isProjectCategory("hobby"));
  assert.ok(!isProjectCategory(""));
});

test("sortByOrder is ascending, unset sorts last, ties break by title", () => {
  const input: { title: string; order?: number }[] = [
    { title: "Beta", order: 2 },
    { title: "NoOrderB" },
    { title: "Alpha", order: 1 },
    { title: "AlsoOne", order: 1 },
    { title: "NoOrderA" },
  ];
  const out = sortByOrder(input);
  assert.deepEqual(
    out.map((p) => p.title),
    ["Alpha", "AlsoOne", "Beta", "NoOrderA", "NoOrderB"],
  );
});

test("sortByOrder does not mutate its input", () => {
  const input = [
    { title: "B", order: 2 },
    { title: "A", order: 1 },
  ];
  const snapshot = input.map((p) => p.title);
  sortByOrder(input);
  assert.deepEqual(
    input.map((p) => p.title),
    snapshot,
  );
});

test("groupByCategory preserves category order, sorts within, drops empty", () => {
  const mk = (title: string, category: ProjectCategory, order?: number) => ({
    title,
    category,
    order,
  });
  const input = [
    mk("Making Two", "making", 2),
    mk("Work One", "work", 1),
    mk("Making One", "making", 1),
    mk("Work Two", "work", 2),
  ];
  const sections = groupByCategory(input);
  // Tinkering is empty -> dropped; the rest keep the fixed order.
  assert.deepEqual(
    sections.map((s) => s.key),
    ["work", "making"],
  );
  assert.deepEqual(
    sections[0].projects.map((p) => p.title),
    ["Work One", "Work Two"],
  );
  assert.deepEqual(
    sections[1].projects.map((p) => p.title),
    ["Making One", "Making Two"],
  );
});

test("parseProjectFrontmatter reads the known keys and the body", () => {
  const raw = [
    "---",
    "title: Eagle SNAP",
    "category: work",
    "tagline: An iPad app for runway condition reports",
    "cover: eagle-snap.png",
    "tags: [iPad, iOS]",
    "order: 5",
    "href: https://example.com",
    "featured: true",
    "---",
    "Body paragraph.",
  ].join("\n");
  const { data, content } = parseProjectFrontmatter(raw);
  assert.equal(data.title, "Eagle SNAP");
  assert.equal(data.category, "work");
  assert.equal(data.tagline, "An iPad app for runway condition reports");
  assert.equal(data.cover, "eagle-snap.png");
  assert.deepEqual(data.tags, ["iPad", "iOS"]);
  assert.equal(data.order, 5);
  assert.equal(data.href, "https://example.com");
  assert.equal(data.featured, true);
  assert.match(content, /Body paragraph\./);
});

test("parseProjectFrontmatter throws on a missing required field", () => {
  const raw = ["---", "title: No Tagline", "category: work", "---", "x"].join("\n");
  assert.throws(() => parseProjectFrontmatter(raw), /missing required field: tagline/);
});

test("parseProjectFrontmatter throws on an unknown category", () => {
  const raw = [
    "---",
    "title: Bad",
    "category: hobby",
    "tagline: Nope",
    "---",
    "x",
  ].join("\n");
  assert.throws(() => parseProjectFrontmatter(raw), /Unknown project category/);
});

test("every content/projects file has a valid category and a title-matching slug", () => {
  const projects = getAllProjects();
  assert.ok(projects.length > 0, "expected at least one seeded project");
  for (const p of projects) {
    assert.ok(isProjectCategory(p.category), `bad category on ${p.slug}`);
    assert.equal(p.slug, slugify(p.title), `slug/title drift on ${p.slug}`);
    assert.ok(p.tagline.trim().length > 0, `empty tagline on ${p.slug}`);
  }
});
