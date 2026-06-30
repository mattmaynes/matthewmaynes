# 0004 - SEO, favicon, and link-sharing metadata

## Problem

`matthewmaynes.com` is functionally invisible to the parts of the web that decide how a link looks
and ranks. Today the site ships only a base `<title>` + `description` and the stock Next.js
`favicon.ico`. There is no Open Graph or Twitter-card markup, so when the URL is texted, posted to
LinkedIn/X, or pasted into Slack, the preview is blank or a bare URL. There is no real favicon, no
`robots.txt`, no `sitemap.xml`, no web manifest, and no structured data. For a personal-brand site
whose whole job is to be shared and found, that is the gap this spec closes.

Audience (from the developer): anyone who receives or discovers the link - peers, recruiters,
people Matthew has just met - plus the crawlers (Google, social scrapers) that render the preview
and the search result.

## Outcome

When done:

- **Favicon**: the metal "M" logo shows in browser tabs, bookmarks, history, and the iOS/Android
  home-screen "add to home screen" tile - at every size, crisp, light and dark backgrounds alike.
- **Link preview**: texting or posting `matthewmaynes.com` (or any page) yields a rich card - a
  branded 1200x630 image (metal M logo + "Matthew Maynes" + "Engineering Director" + tagline on a
  Harbor-dark background), the page title, and the description. Verified in the Open Graph and
  Twitter/X debuggers.
- **Discoverability**: `/robots.txt` and `/sitemap.xml` exist and are valid; every public route is
  listed; search engines are invited to index. A JSON-LD `Person` block makes the identity
  machine-readable (name, role, canonical URL, verified social profiles).
- **Installability/polish**: a web manifest gives the site a name, short name, theme color, and
  maskable icons; `theme-color` tints mobile browser chrome to match the active theme.

## Scope

**In**

- **Brand assets** (`src/app/` file conventions + `public/`):
  - `public/brand/logo-m.png` - the 600x600 plain-M master (transparent corners), already copied
    into the repo, is the source of truth for the favicon set + OG image + manifest.
  - `src/app/favicon.ico` - real multi-resolution ICO (16/32/48), replacing the Next default.
  - `src/app/icon.png` (512) and `src/app/apple-icon.png` (180) - Next auto-wires the `<link>` tags.
  - `public/icon-192.png`, `public/icon-512.png` (+ a maskable variant) for the manifest.
  - A committed, dependency-free generator (`scripts/build-icons.mjs`, Node stdlib + macOS `sips`)
    so the icon set is reproducible from the master, not a pile of mystery binaries.
- **Default social metadata** in `src/app/layout.tsx` (inherited by every page, overridable):
  `openGraph` (type=website, siteName, locale=en_US, url, title, description) and `twitter`
  (card=summary_large_image, creator=`@mattmaynes` derived from `site.social.x`). Per-page
  `title`/`description` already set continue to flow through.
- **Generated OG image**: `src/app/opengraph-image.tsx` via `next/og` `ImageResponse` - the branded
  card above, rendered in the brand font (Figtree, loaded from the installed
  `@fontsource-variable/figtree`). `src/app/twitter-image.tsx` re-exports it so X gets the same card.
- **`src/app/robots.ts`** - allow all, point at the sitemap.
- **`src/app/sitemap.ts`** - the six public routes from `nav` in `src/lib/site.ts`, single source.
- **`src/app/manifest.ts`** - name/short_name/description, `theme_color` + `background_color` from
  Harbor tokens, `display: standalone`, the 192/512/maskable icons.
- **`viewport` export** (`themeColor`, light/dark via media query) in `layout.tsx`.
- **JSON-LD `Person`** structured data injected once in `layout.tsx` (name, jobTitle, url, image,
  `sameAs`: the three social URLs already in `site.social`).
- **`src/lib/site.ts`**: centralize the shared `description` (currently inline in `layout.tsx`) and
  add an `ogImageAlt`, so metadata, OG card, and JSON-LD read one source.
- **Tests**: extend the standalone smoke test to assert the social/SEO surface (below).
- **Reflect**: update `docs/overview/features.md` (new "SEO & sharing" global behavior) and
  `architecture.md` (metadata/asset-convention note); log any gotcha in `learnings.md`.

**Out** (later / other specs)

- Per-page hand-tuned OG images or descriptions (e.g. a unique card per blog post). This ships one
  strong default card for the whole site; `/blog/[slug]` bespoke cards are a follow-up once posts
  exist.
- Self-referencing `<link rel="canonical">` per route. Clean, stable URLs + `metadataBase` are
  enough for launch; add canonicals if/when query-string or duplicate paths appear.
- Analytics, search-console verification meta tags, RSS feed - separate concerns.
- Any redesign of the logo or a new wordmark. We use the existing metal M as-is.
- A Content-Security-Policy (already tracked separately in `next.config.ts`); the inline JSON-LD
  and theme script are noted there for the future CSP hash work.

## Approach

- **Idiomatic Next 16 file conventions** over hand-rolled `<head>` tags: `favicon.ico`, `icon.png`,
  `apple-icon.png`, `opengraph-image.tsx`, `twitter-image.tsx`, `manifest.ts`, `robots.ts`,
  `sitemap.ts`. Next emits correctly-typed, correctly-sized, cache-busted tags - less to get wrong
  than manual links, and it keeps `layout.tsx` to data, not markup.
- **One master asset, generated sizes.** `sips` (built into macOS) resizes `public/brand/logo-m.png`;
  a ~40-line stdlib script packs the multi-res `favicon.ico` (PNG-payload ICO, no ImageMagick, no
  new dependency). Re-runnable, with the exact commands in the script header.
- **OG card in `next/og`**, not a static export, so it regenerates if the name/title/tagline ever
  change and stays pixel-consistent with the favicon (same logo). Harbor-dark background
  (`slate-950` #14222f with a subtle harbor gradient), light text, logo top-left or centered.
  Render at the OG node runtime; load Figtree from `node_modules` as the font buffer.
- **Single source of truth.** Routes come from `nav`; identity/description/social from `site`. No
  duplicated strings between the sitemap, JSON-LD, manifest, and meta tags.
- **ASCII-only** copy and straight quotes per Trellis. No PII beyond what is already public (name,
  role, region, existing social handles).
- **Build in a worktree**, test before commit, open a PR, review with the personas the diff touches
  (engineer - new code/asset pipeline; tester - new observable output; security - new public routes
  + a build script; architect if the asset/metadata layering is non-trivial), merge on approval.

## Acceptance

- [ ] Browser tab shows the metal-M favicon on every page; `/favicon.ico`, the PNG `icon`, and the
      `apple-icon` all resolve and render crisp (no upscaled blur at 180/512).
- [ ] Viewing source / the rendered `<head>` shows `og:title`, `og:description`, `og:image`
      (1200x630, absolute URL), `og:url`, `og:type`, `og:site_name`, and `twitter:card`
      =`summary_large_image` with `twitter:image` and `twitter:creator`.
- [ ] The generated OG image renders the metal M + "Matthew Maynes" + "Engineering Director" +
      tagline, legibly, in the brand font, on the Harbor-dark background. Confirmed by opening the
      `opengraph-image` route and (where reachable) a social debugger.
- [ ] `/robots.txt` returns valid rules and references the sitemap; `/sitemap.xml` lists all six
      public routes with `lastModified`; `/manifest.webmanifest` returns valid JSON with name,
      theme color, and 192/512 icons.
- [ ] A JSON-LD `Person` block is present once in the page, validates (no schema errors), and its
      `sameAs` lists the LinkedIn, GitHub, and X URLs from `site.social`.
- [ ] `theme-color` is present and matches the light/dark Harbor chrome.
- [ ] `npm run lint` and `npm run build` pass; the smoke test asserts the og:image meta, the icon
      link, the JSON-LD script, and 200s for `/robots.txt`, `/sitemap.xml`, `/manifest.webmanifest`.
- [ ] `docs/overview/` updated (features + architecture, and learnings if anything bit us).

## Notes

- Logo master: `public/brand/logo-m.png` (the plain M, 600x600, transparent corners), the source
  of truth for every generated icon size.
- Harbor tokens for the card/manifest: bg `--color-slate-950` #14222f, primary `--color-harbor-600`
  #2c557b, light text `--color-slate-50` #f6f7f9 (`src/styles/theme-harbor.css`).
- Twitter handle derives from `site.social.x` (`https://x.com/mattmaynes` -> `@mattmaynes`).
- `metadataBase` already set in `layout.tsx`, so relative OG/image URLs resolve to absolute - keep
  using it rather than hard-coding the host.
