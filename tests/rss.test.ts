// Unit tests for the pure RSS builder (src/lib/rss.js): XML escaping, RFC-822
// date formatting, and the RSS 2.0 feed shape. No server, no fs - the builder is
// a pure function of its posts, so the whole feed is asserted here. Runs via
// `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { escapeXml, toRfc822, buildBlogFeed } from "../src/lib/rss.ts";
import { getAllPosts, getPublishedPosts } from "../src/lib/blog.ts";

test("escapeXml escapes the five XML metacharacters, ampersand first", () => {
  // A single call must escape all five without double-escaping the entities'
  // own ampersands (which is why `&` is replaced first).
  assert.equal(
    escapeXml(`Tom & Jerry <3 "quote" 'apos'`),
    "Tom &amp; Jerry &lt;3 &quot;quote&quot; &apos;apos&apos;",
  );
  // Ampersand-first ordering: a lone `&` becomes `&amp;`, never `&amp;amp;`.
  assert.equal(escapeXml("a & b"), "a &amp; b");
  assert.equal(escapeXml("<>"), "&lt;&gt;");
});

test("toRfc822 formats a YYYY-MM-DD date as UTC RFC-822 with the right weekday", () => {
  // 2026-06-28 is a Sunday.
  assert.equal(toRfc822("2026-06-28"), "Sun, 28 Jun 2026 00:00:00 GMT");
  // A different month/weekday, day-padded.
  assert.equal(toRfc822("2026-01-05"), "Mon, 05 Jan 2026 00:00:00 GMT");
});

test("toRfc822 throws on an unparseable date instead of emitting NaN", () => {
  // A malformed frontmatter date must fail the build, not ship an invalid
  // "NaN undefined NaN" pubDate that feed readers reject.
  assert.throws(() => toRfc822("not-a-date"), /unparseable date/);
  assert.throws(() => toRfc822("2026-13-40"), /unparseable date/);
});

test("buildBlogFeed emits a well-formed RSS 2.0 feed, one item per post, order preserved", () => {
  const posts = [
    { slug: "newest", title: "Newest Post", date: "2026-06-28", excerpt: "Newest." },
    { slug: "older", title: "Older Post", date: "2026-01-05", excerpt: "Older." },
  ];
  const xml = buildBlogFeed({
    posts,
    siteUrl: "https://example.com",
    title: "Example - Blog",
    description: "Example description.",
  });

  // Channel shell.
  assert.match(xml, /<rss version="2.0" xmlns:atom="http:\/\/www\.w3\.org\/2005\/Atom">/);
  assert.match(xml, /<title>Example - Blog<\/title>/);
  assert.match(xml, /<description>Example description\.<\/description>/);
  assert.match(xml, /<language>en-ca<\/language>/);
  assert.match(
    xml,
    /<atom:link rel="self" type="application\/rss\+xml" href="https:\/\/example\.com\/blog\/feed\.xml"\/>/,
  );
  // Channel <link> points at the listing.
  assert.match(xml, /<link>https:\/\/example\.com\/blog<\/link>/);

  // Item count = posts length.
  const items = xml.match(/<item>/g) ?? [];
  assert.equal(items.length, posts.length, "one <item> per post");

  // Order preserved: the newest post's title appears before the older one's.
  assert.ok(
    xml.indexOf("Newest Post") < xml.indexOf("Older Post"),
    "items must stay newest-first (input order preserved)",
  );

  // Absolute links + permalink guid for each post.
  assert.match(xml, /<link>https:\/\/example\.com\/blog\/newest<\/link>/);
  assert.match(
    xml,
    /<guid isPermaLink="true">https:\/\/example\.com\/blog\/older<\/guid>/,
  );

  // pubDate is RFC-822.
  assert.match(xml, /<pubDate>Sun, 28 Jun 2026 00:00:00 GMT<\/pubDate>/);

  // lastBuildDate = newest post's date (deterministic, not Date.now()).
  assert.match(
    xml,
    /<lastBuildDate>Sun, 28 Jun 2026 00:00:00 GMT<\/lastBuildDate>/,
  );
});

test("buildBlogFeed XML-escapes interpolated title and excerpt", () => {
  const posts = [
    {
      slug: "amp",
      title: "Ampersands & <Angles>",
      date: "2026-06-28",
      excerpt: 'Quote "x" & <y>',
    },
  ];
  const xml = buildBlogFeed({
    posts,
    siteUrl: "https://example.com",
    title: "T",
    description: "D",
  });

  // Escaped, so the XML stays well-formed; the raw metacharacters must not
  // appear inside the interpolated title/excerpt.
  assert.match(xml, /<title>Ampersands &amp; &lt;Angles&gt;<\/title>/);
  assert.match(xml, /<description>Quote &quot;x&quot; &amp; &lt;y&gt;<\/description>/);
  assert.ok(
    !xml.includes("Ampersands & <Angles>"),
    "raw unescaped title must not leak into the feed",
  );
});

test("buildBlogFeed joins absolute links even when siteUrl has a trailing slash", () => {
  const posts = [
    { slug: "post", title: "Post", date: "2026-06-28", excerpt: "x" },
  ];
  const xml = buildBlogFeed({
    posts,
    siteUrl: "https://example.com/",
    title: "T",
    description: "D",
  });
  // No doubled slash: new URL normalizes the join.
  assert.match(xml, /<link>https:\/\/example\.com\/blog\/post<\/link>/);
  assert.ok(!xml.includes("example.com//blog"), "must not double the slash");
});

test("the feed excludes a scheduled post before its time and includes it after (spec 0035)", () => {
  // The feed route builds from the time-aware getPublishedPosts, so a scheduled
  // post must be absent from the feed until its publishAt, then present - "not
  // live early in the RSS feed, live on time". Drive it with the sample
  // scheduled fixture and an injected clock (no wall-clock).
  const schedSlug = "this-is-a-sample-scheduled-post";
  const scheduledPost = getAllPosts().find((p) => p.slug === schedSlug);
  assert.ok(scheduledPost?.publishAt, "fixture sanity: the sample scheduled post carries a publishAt");
  const dueMs = Date.parse(scheduledPost.publishAt);
  const feedFor = (nowMs) =>
    buildBlogFeed({
      posts: getPublishedPosts(nowMs),
      siteUrl: "https://example.com",
      title: "T",
      description: "D",
    });

  const before = feedFor(dueMs - 1);
  assert.ok(
    !before.includes(scheduledPost.title),
    "a scheduled post must not appear in the feed before its publishAt",
  );
  assert.ok(
    !before.includes(`/blog/${schedSlug}`),
    "a scheduled post's URL must not appear in the feed before its publishAt",
  );

  const after = feedFor(dueMs);
  assert.ok(
    after.includes(scheduledPost.title),
    "a scheduled post must appear in the feed once its publishAt passes",
  );
});

test("buildBlogFeed on an empty feed omits lastBuildDate and has no items", () => {
  const xml = buildBlogFeed({
    posts: [],
    siteUrl: "https://example.com",
    title: "T",
    description: "D",
  });
  assert.ok(!xml.includes("<item>"), "no items for an empty feed");
  assert.ok(!xml.includes("<lastBuildDate>"), "no lastBuildDate for an empty feed");
});
