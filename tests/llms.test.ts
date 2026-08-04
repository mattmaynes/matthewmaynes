// Unit tests for the pure /llms.txt builder (src/lib/llms.ts). No server, no fs:
// the builder is a pure function of { site, nav, posts }, so the whole briefing
// is asserted here against a multi-post fixture (including a draft to prove the
// filtering is the caller's job and the builder renders exactly what it is fed).
// Runs via `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLlmsTxt } from "../src/lib/llms.ts";

const SITE = {
  name: "Matthew Maynes",
  title: "Engineering Director",
  tagline: "An endlessly curious problem solver who can't help but build things",
  description: "Personal site of Matthew Maynes.",
  url: "https://example.com",
};

const NAV = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About" },
  { href: "/blog", label: "Blog" },
];

// Two published posts (newest-first, as getPublishedPosts returns). The draft is
// NOT in this list - the route filters it out via getPublishedPosts, so the
// builder never sees it; we prove a draft's markers are absent below.
const POSTS = [
  {
    slug: "newest-post",
    title: "The Newest Post",
    date: "2026-06-28",
    excerpt: "A fresh take on things.",
  },
  {
    slug: "older-post",
    title: "An Older Post",
    date: "2026-01-05",
    excerpt: "Something from a while ago.",
  },
];

test("buildLlmsTxt renders the identity header, tagline, and description", () => {
  const out = buildLlmsTxt({ site: SITE, nav: NAV, posts: POSTS });
  // H1 names who this is (title included so an answer engine gets the role).
  assert.match(out, /^# Matthew Maynes - Engineering Director$/m);
  // The tagline appears as the intro blockquote.
  assert.ok(
    out.includes("An endlessly curious problem solver who can't help but build things"),
    "expected the tagline in the intro",
  );
  assert.ok(out.includes("Personal site of Matthew Maynes."), "expected the description");
  // Section headers present.
  assert.match(out, /^## Pages$/m);
  assert.match(out, /^## Writing$/m);
  assert.match(out, /^## More$/m);
});

test("buildLlmsTxt lists every nav page with an absolute URL", () => {
  const out = buildLlmsTxt({ site: SITE, nav: NAV, posts: POSTS });
  assert.ok(out.includes("- [Home](https://example.com/)"), "expected the Home page link");
  assert.ok(out.includes("- [About](https://example.com/about)"), "expected the About page link");
  assert.ok(out.includes("- [Blog](https://example.com/blog)"), "expected the Blog page link");
});

test("buildLlmsTxt lists every published post: title, absolute URL, date, excerpt", () => {
  const out = buildLlmsTxt({ site: SITE, nav: NAV, posts: POSTS });
  // Each post: a titled absolute link, its date, and its excerpt - exactly the
  // shape an answer engine can map. These are values a blank/reverted builder
  // could NOT produce.
  assert.ok(
    out.includes(
      "- [The Newest Post](https://example.com/blog/newest-post) - 2026-06-28 - A fresh take on things.",
    ),
    "expected the newest post's full line",
  );
  assert.ok(
    out.includes(
      "- [An Older Post](https://example.com/blog/older-post) - 2026-01-05 - Something from a while ago.",
    ),
    "expected the older post's full line",
  );
  // Order preserved: newest-first (as the input arrives).
  assert.ok(
    out.indexOf("The Newest Post") < out.indexOf("An Older Post"),
    "expected posts newest-first (input order preserved)",
  );
});

test("buildLlmsTxt omits a post that was not passed in (drafts never leak)", () => {
  // The route feeds the builder getPublishedPosts(), so a draft is filtered out
  // BEFORE the builder sees it. Prove a draft's markers do not appear when it is
  // not in the list - the failable guard against a future regression that fed the
  // builder getAllPosts().
  const out = buildLlmsTxt({ site: SITE, nav: NAV, posts: POSTS });
  assert.ok(!out.includes("This Is a Sample Draft"), "a draft title must not appear");
  assert.ok(
    !out.includes("/blog/this-is-a-sample-draft"),
    "a draft URL must not appear",
  );
});

test("buildLlmsTxt links the RSS feed and the AI policy in the More section", () => {
  const out = buildLlmsTxt({ site: SITE, nav: NAV, posts: POSTS });
  assert.ok(
    out.includes("- [RSS feed](https://example.com/blog/feed.xml)"),
    "expected the RSS feed link",
  );
  assert.ok(
    out.includes("- [AI policy](https://example.com/ai-policy)"),
    "expected the AI policy link",
  );
});

test("buildLlmsTxt joins absolute URLs even when the site URL has a trailing slash", () => {
  const out = buildLlmsTxt({
    site: { ...SITE, url: "https://example.com/" },
    nav: NAV,
    posts: POSTS,
  });
  assert.ok(out.includes("https://example.com/blog/newest-post"), "expected a clean join");
  assert.ok(!out.includes("example.com//blog"), "must not double the slash");
});

test("buildLlmsTxt is deterministic (no Date.now / locale drift)", () => {
  // Byte-identical across calls: a pure function of its inputs, so it is safe to
  // cache and diff (like the RSS feed).
  const a = buildLlmsTxt({ site: SITE, nav: NAV, posts: POSTS });
  const b = buildLlmsTxt({ site: SITE, nav: NAV, posts: POSTS });
  assert.equal(a, b);
});

test("buildLlmsTxt handles an empty post list without breaking the sections", () => {
  const out = buildLlmsTxt({ site: SITE, nav: NAV, posts: [] });
  assert.match(out, /^## Writing$/m);
  assert.ok(out.includes("No posts published yet."), "expected an empty-writing note");
});

// spec 0042: the file exists to invite answer engines, so it must state the terms
// rather than stay silent - and it must draw the line the author actually wants:
// the TEXT is quotable, the images and video are not reusable and not training
// data. Asserting both halves plus the /terms link, because a section that only
// said "all rights reserved" would contradict the file's own purpose and a
// section that only granted the text would leave the media unstated.
test("buildLlmsTxt states the content usage terms, splitting text from media", () => {
  const out = buildLlmsTxt({ site: SITE, nav: NAV, posts: POSTS });
  assert.match(out, /^## Usage$/m, "expected a Usage section");
  // Scoped to the section body, so a matching phrase drifting into Writing or
  // More cannot satisfy these.
  const usage = out.slice(out.indexOf("## Usage"), out.indexOf("## More"));
  assert.ok(
    usage.includes("may be read, quoted, and cited with attribution"),
    "expected the TEXT to be explicitly quotable (this file invites answer engines)",
  );
  assert.ok(
    usage.includes("may not be reproduced, redistributed, or used as training data"),
    "expected the images and video to be explicitly reserved",
  );
  assert.ok(
    usage.includes(`${SITE.url}/terms`),
    "expected an absolute link to the authoritative terms page",
  );
  // Usage must precede More, so a crawler reading top-down hits the terms before
  // the feed links rather than after them.
  assert.ok(
    out.indexOf("## Usage") < out.indexOf("## More"),
    "expected Usage to sit above More",
  );
});
