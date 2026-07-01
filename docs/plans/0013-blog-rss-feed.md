# Plan 0013 - Blog RSS feed

Source spec: `docs/specs/0013-blog-rss-feed.md`.

## Design decisions

- **Pure feed builder, thin route.** Feed XML is assembled by a pure, fs-free, node-testable module
  `src/lib/rss.js` (like `blog-view.js`); the route handler is a thin shell that loads posts and
  returns the string with the right headers. This keeps XML-escaping and date formatting under
  `node --test` without booting a server.
- **Absolute URLs from `site.url`.** Every link uses `new URL(path, site.url).toString()` (the
  sitemap's pattern). `site.url` is `SITE_URL` env or the production default.
- **Deterministic output.** `lastBuildDate` uses the newest post's date (not `Date.now()`), so the
  feed is a pure function of the content and the builder is fully unit-testable.

## Steps

1. **`src/lib/rss.js`** (pure, fs-free):
   - `escapeXml(str)` -> escapes `& < > " '` (ampersand first). Unit-tested against a string with
     all five.
   - `toRfc822(dateStr)` -> RFC-822 date, e.g. `"2026-06-28"` -> `"Sun, 28 Jun 2026 00:00:00 GMT"`.
     Parse as UTC midnight (like `formatPostDate`); build from fixed day/month name tables (no locale
     dependence). Unit-tested for a known date + the weekday.
   - `buildBlogFeed({ posts, siteUrl, title, description })` -> RSS 2.0 XML string. `<rss version="2.0"
     xmlns:atom="...">`, one `<channel>` with `<title>`, `<link>` = `${siteUrl}/blog`, `<description>`,
     `<language>en-ca</language>`, `<atom:link rel="self" type="application/rss+xml" href=".../blog/feed.xml"/>`,
     `<lastBuildDate>` = newest post's RFC-822 date, then one `<item>` per post (posts arrive
     newest-first from `getAllPosts`): `<title>` (escaped), `<link>`/`<guid isPermaLink="true">` =
     `${siteUrl}/blog/${slug}`, `<pubDate>` = `toRfc822(post.date)`, `<description>` = escaped
     `post.excerpt`. Unit-test: item count = posts length, order preserved, a post with an `&`/`<` in
     title/excerpt is escaped, links are absolute.
2. **Route `src/app/blog/feed.xml/route.ts`:** `export const dynamic = "force-static";` and a `GET`
   that calls `getAllPosts()` (server, fs OK), builds the feed via `buildBlogFeed`, and returns
   `new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } })`. Channel
   title/description come from `site` (e.g. `${site.name} - Blog`).
3. **`src/components/blog-icons.tsx`:** add an `RssIcon` wrapper over `@rogueoak/icons` `Rss`
   (`aria-hidden`, same pattern as `ClockIcon`/`SearchIcon`).
4. **Subscribe buttons:**
   - Listing (`src/app/blog/page.tsx`): an RSS subscribe control near the `<h1>Blog</h1>`/intro - a
     Canopy `Button variant="ghost"` (or the ghost-icon treatment used in the footer) `asChild` over
     `<a href="/blog/feed.xml">` with `aria-label="Subscribe to the blog via RSS"` and the `RssIcon`
     (+ a visible "RSS" label is fine).
   - Post (`src/app/blog/[slug]/page.tsx`): the same subscribe link in the header meta row or beside
     "Back to blog".
5. **Autodiscovery:** add `alternates: { types: { "application/rss+xml": [{ url: "/blog/feed.xml",
   title: "<site name> - Blog" }] } }` to the blog listing `metadata` and to the post
   `generateMetadata` return, so the `<link rel="alternate" type="application/rss+xml">` is emitted
   in `<head>` without hand-writing it.
6. **Tests:**
   - `tests/blog.test.mjs` (or a new `tests/rss.test.mjs` - keep `--test-concurrency=1` in mind, the
     existing pattern is fine): unit-test `escapeXml`, `toRfc822`, and `buildBlogFeed` per above.
   - `tests/smoke.test.mjs`: add a test that fetches `/blog/feed.xml` on the standalone server and
     asserts `200`, `Content-Type` starts with `application/rss+xml`, and the body contains the seed
     post title and `<rss`. Also extend the `/blog` case `contains` with `href="/blog/feed.xml"` so
     the subscribe link is guarded. (Mirror the existing og:image smoke test style.)
7. **Verify (mirror CI, in the worktree):** `npm ci`, then `npm run lint`, `npm run resume:pdf:check`,
   `npm run build`, `npm test`. The feed route must show as static (`○`/prerendered) in the build
   output. All green before commit.
8. **Reflect:** update `docs/overview/features.md` (a `/blog/feed.xml` feed + subscribe buttons +
   autodiscovery are live) and `docs/overview/architecture.md` (the pure `rss.js` builder + static
   feed route join the blog seam). Learning only if friction surfaced.

## Files touched

- `src/lib/rss.js` (new), `src/app/blog/feed.xml/route.ts` (new)
- `src/components/blog-icons.tsx` (RssIcon)
- `src/app/blog/page.tsx`, `src/app/blog/[slug]/page.tsx` (subscribe button + autodiscovery)
- `tests/*` (unit + smoke)
- `docs/overview/features.md` (+ `architecture.md`)

## Verification checklist

- [ ] `GET /blog/feed.xml` -> 200, `application/rss+xml`, well-formed RSS 2.0, newest-first items with
      absolute links + escaped title/description.
- [ ] `escapeXml` / `toRfc822` / `buildBlogFeed` unit-tested (escaping, RFC-822 date, order, count).
- [ ] Subscribe (RSS) link on `/blog` and `/blog/[slug]`, pointing at `/blog/feed.xml`.
- [ ] `<link rel="alternate" type="application/rss+xml">` autodiscovery on the blog pages.
- [ ] Feed route is statically generated (build output shows it prerendered).
- [ ] lint + resume:pdf:check + build + test all green.
