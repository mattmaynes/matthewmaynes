# 0013 - Blog RSS feed

## Problem

There is no way to subscribe to the blog. Readers who use a feed reader cannot follow new posts, and
there is no machine-readable feed for the site. The blog is statically generated from
`content/blog/*.mdx`, so a standards-compliant RSS feed is cheap to produce and keeps the site
followable without email capture.

## Outcome

- **A valid RSS 2.0 feed** is served at a stable path (`/blog/feed.xml`), listing all posts
  newest-first with title, link (absolute), publish date, and description (the post excerpt). It
  validates and loads in common feed readers.
- **Subscribe buttons** appear on the blog listing (`/blog`) and on each post (`/blog/[slug]`): an
  `Rss` icon button linking to the feed, so a reader can grab it from either surface.
- **Feed autodiscovery**: the blog pages advertise the feed via
  `<link rel="alternate" type="application/rss+xml">`, so readers that accept a page URL find the
  feed automatically.

## Scope

**In**

- A feed route handler generating RSS 2.0 XML from `getAllPosts()`.
- `Rss` subscribe button on the listing and post pages.
- `<link rel="alternate">` autodiscovery on the blog surfaces.
- Correct `Content-Type` (`application/rss+xml`) and cacheable static generation.

**Out**

- Atom and JSON Feed variants (RSS 2.0 only for now).
- Full post **body** in the feed (excerpt/description only; keeps the feed small and avoids shipping
  compiled MDX/HTML - a follow-up can add `content:encoded` if wanted).
- Per-tag or per-category feeds.
- A site-wide feed beyond the blog.

## Approach

- **Route:** an App Router route handler (e.g. `src/app/blog/feed.xml/route.ts`) that builds the XML
  string from posts and returns it with `Content-Type: application/rss+xml; charset=utf-8`. Force
  static (`export const dynamic = "force-static"`) so it bakes at build like the rest of the site
  (no runtime content reads).
- **Absolute URLs** come from `SITE_URL`/`site` config (already the source of truth for canonical
  URLs); each `<item>` uses `<link>` and `<guid isPermaLink="true">` = `${siteUrl}/blog/${slug}`,
  `<pubDate>` = the post date as RFC-822, `<description>` = the escaped excerpt. XML-escape all
  interpolated text (title, excerpt) - a pure `escapeXml` helper, unit-tested, so a stray `&`/`<` in
  a future post cannot produce invalid XML.
- **Feed metadata** (channel title, link, description, language) derives from `site.ts`; no
  duplication.
- **Buttons** use the `Rss` icon (`@rogueoak/icons`) via the client-boundary pattern; the listing
  button sits near the page heading, the post button in the header meta row or footer. Both are
  plain `<a href="/blog/feed.xml">` (Canopy `Button` `asChild`), `aria-label`ed for screen readers.
- **Autodiscovery** via each page's `metadata.alternates.types["application/rss+xml"]` (Next
  metadata) so the `<link>` is emitted without hand-writing `<head>`.

## Acceptance

- [ ] `GET /blog/feed.xml` returns `200` with `application/rss+xml` and well-formed RSS 2.0 listing
      every post newest-first (title, absolute link, pubDate, escaped description).
- [ ] Interpolated text is XML-escaped; `escapeXml` (and the RFC-822 date format) have unit tests.
- [ ] An `Rss` subscribe button links to the feed from both `/blog` and `/blog/[slug]`.
- [ ] Blog pages emit `<link rel="alternate" type="application/rss+xml">` autodiscovery.
- [ ] The feed is statically generated (no per-request content read); path is stable.
- [ ] `npm run lint`, `npm test`, `npm run build` green; a smoke assertion fetches the feed path and
      asserts `200` + `application/rss+xml` + a known post title (mirrors the OG-image smoke check).
