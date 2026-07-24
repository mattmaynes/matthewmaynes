# 0039 - Links page (link-in-bio + subscribe)

## Problem

I want one URL to hand out from a social-media bio ("link in bio") - a single, mobile-first
landing page that funnels a first-time visitor from a post or profile into the two things worth
their time: **reading the blog** and **subscribing** to follow along, with my **social channels**
one tap away. The existing `/subscribe` page is a mailing-list ask; it does not read like the
tappable, brand-forward stack a bio link wants, and it does not surface the social profiles. I need
a purpose-built surface I can drop into Instagram / X / LinkedIn / Facebook bios.

Audience: someone who just found me on social media, on a phone, deciding in a few seconds whether
to go deeper.

## Outcome

- A new route **`/links`** renders a **tight, mobile-first** "link in bio" column, ordered by
  intent (the primary links first, a taste of the writing last):
  1. a **compact identity header** - a small circular headshot avatar, my name, and a one-line
     title + region (kept minimal so the links are the focus);
  2. the primary **links**: a full-width **"Read the blog"** button to `/blog`, then a row of the
     **social channels** - LinkedIn, Instagram, X, Facebook, GitHub - as tappable icon buttons
     opening each profile in a new tab;
  3. a **subscribe** block (the shared subscribe form) to follow along by email;
  4. a **Latest post** feature card (cover + title + reading-time) linking to the newest published
     post, so a visitor gets an immediate taste of the writing (omitted only if there are no posts).
- The page is **mobile-optimized first** - a small avatar and tight vertical rhythm so the links
  sit high on a phone - and scales up cleanly (a narrow column that stays centred on desktop).
- The site **footer** gains a **`Links`** entry, shown **only on larger screens** (`sm` and up) and
  hidden on mobile where the footer is already crammed.
- Subscribes from this page are attributable in analytics via a new PII-free `links_page` source
  dimension; the page carries **no contact PII** (no email/phone), consistent with the public-repo
  rule.
- `/links` is listed in the sitemap (like `/subscribe`) so the shared URL is crawlable, and it
  shares the default site OG/Twitter card so a pasted link unfurls.

## Scope

**In**

- New Server Component route `src/app/links/page.tsx` with its own metadata and the `revalidate = 60`
  ISR window (so the Latest-post card picks up a scheduled post on its own, matching `/subscribe`).
- Reuse of existing pieces: `SubscribeForm`, the social glyphs in `social-icons.tsx` + `site.social`,
  the `ReadingTimePill`, the blog helpers (`getPublishedPosts`, `readingMinutes`, `formatPostDate`),
  and the staged `headshot` image.
- Footer `Links` link (desktop-only).
- Sitemap entry for `/links`.
- A new `"links_page"` value in the `SubscribeForm` `source` union.
- Tests: a `/links` smoke route entry + a footer-link assertion.

**Out**

- No change to `/subscribe` (it stays the dedicated mailing-list landing page; the two coexist).
- No new nav entry (the page is intentionally out of the top nav; it is a hand-out URL).
- No new backend, endpoint, or secret - subscribe reuses `POST /v1/subscribe` unchanged.
- No bespoke OG card for `/links` (the default site card is sufficient; a custom one can be a later
  spec if wanted).

## Approach

- **One column, reused parts.** The page is a Server Component that renders a centred
  `max-w-md`-ish column. The identity header uses the existing static-imported `headshot` (carries
  its `blurDataURL`), rendered circular. The Latest-post card is a compact **cover-on-top** variant
  (the narrow column favours a vertical card over the side-by-side `/subscribe` treatment); it
  resolves the cover server-side exactly like `/subscribe` and honours the `pixelated` flag. The
  subscribe block is the shared `SubscribeForm` with `alwaysShowName` and its own heading off, under
  a short page-level lead-in. The social row maps `site.social` through the existing icon wrappers as
  large icon buttons (each an `<a target="_blank" rel="noopener noreferrer">` with an
  `aria-label`), the same treatment the footer already uses, sized up for touch.
- **Footer link, desktop-only.** Add a `Links` item to the footer's copyright line wrapped so the
  separator + link are `hidden sm:inline` - present in the SSR HTML but visually hidden on mobile
  (CSS, not removed), keeping the mobile footer uncluttered while larger screens get the entry.
- **Analytics dimension.** Extend the `SubscribeForm` `source` union with `"links_page"` and pass it
  from the page, so the existing PII-free `blog_subscribe_*` events attribute this surface without
  any new event or PII.
- **Discoverability.** Add `/links` to the sitemap's `EXTRA_ROUTES` (same rationale as `/subscribe`:
  a deliberately-out-of-nav but shareable landing page).

Key trade-offs: reuse over novelty (no new form/endpoint/card component where an existing one fits);
socials as a compact icon row rather than five full-width buttons (keeps the stated primary asks -
blog + subscribe - visually dominant and avoids a long scroll on mobile); default OG card over a
bespoke one (ship the page now, add a custom card later only if the bio link warrants it).

## Acceptance

- [ ] `GET /links` returns 200 with `<title>Links - Matthew Maynes</title>` and a rendered `<h1>`.
- [ ] The page renders, in order: the compact identity header (name + title/region), a **Read the
      blog** button to `/blog`, a social row linking all five profiles (each `target="_blank"
      rel="noopener noreferrer"`), the subscribe form, and a **Latest post** card linking to the
      newest published post.
- [ ] The page inlines a blur placeholder (the headshot), and shows no email/phone (PII-free).
- [ ] A not-yet-due scheduled post / draft never appears in the Latest-post card (uses
      `getPublishedPosts()`), matching every other public surface.
- [ ] The footer exposes a `Links` link to `/links` that is hidden on mobile and shown from `sm` up
      (`hidden sm:inline`), verified by a failable test keyed on that class combo.
- [ ] `/links` appears in `/sitemap.xml`.
- [ ] Subscribes from `/links` pass `source: "links_page"` (union extended; PII-free).
- [ ] `npm run lint`, `npm run build`, and `npm test` all pass.
