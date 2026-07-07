# 0020 - Subscribe UX: inline name field + a shareable /subscribe page

## Problem

Two subscribe-surface gaps for readers who want updates:

1. **The optional Name field jolts the page on desktop.** Spec 0018's progressive
   disclosure reflows the whole subscribe row from inline (`sm:flex-row`) to fully
   stacked (`flex-col`) at *all* widths the moment the email is focused. On a wide
   screen that pushes the Subscribe button down and shifts the surrounding page - a
   jarring jump. Mobile (already stacked) is fine.
2. **There is no focused, shareable place to subscribe.** The subscribe block only
   lives at the bottom of `/blog` and each post. There is no single URL to hand
   someone ("subscribe to my list") that leads with the ask.

## Outcome

- On `sm` and up, revealing the Name field keeps the row **inline**: the email input
  shortens and the Name field appears **between** the email and the Subscribe button;
  the button does not move. Below `sm`, the fields stack (unchanged).
- A new **`/subscribe`** page: a focused landing surface with a heading, a short
  invitation, and the subscribe form showing **all three fields** (email, name,
  button) up front. Below it, the **latest post** ("Latest post") as a card and a
  **See all posts** button to `/blog`. It is **not** in the top nav, but the shared
  nav/footer are present (it uses the root layout). It is listed in the sitemap so it
  is shareable/discoverable.

## Scope

**In**

- `subscribe-form.tsx`: keep the row inline at `sm+` when expanded (email `sm:flex-[2]`,
  Name `sm:flex-1`, button `sm:w-auto`); a new `alwaysShowName` prop (name visible from
  first paint) and a `heading` prop (default true) so the dedicated page can supply its
  own copy; a new PII-free `source: "subscribe_page"` analytics value.
- `src/app/subscribe/page.tsx`: the new page.
- `sitemap.ts`: add `/subscribe` (nav stays unchanged).
- Smoke + doc updates.

**Out**

- The AI-disclosure policy (separate, deliberate copy pass).
- Previous/next post navigation (spec 0021).
- Any change to the `/v1/subscribe` endpoint, Constant Contact wiring, or spam guards -
  the client posts the same payload as today.

## Approach

- **Layout fix.** The container is always `flex flex-col gap-3 sm:flex-row sm:items-end`.
  The Name field's wrapper toggles between `hidden` (collapsed) and `w-full sm:flex-1`
  (revealed) - so the row never switches to `flex-col` at `sm+`. Email becomes
  `sm:flex-[2]` (so it visibly shortens to make room, and the revealed `sm:flex-1` on
  Name is a marker unique to "name shown"). DOM order stays email -> Name -> button, so
  Name renders between them.
- **`alwaysShowName`.** Seeds the `expanded` state true, so `/subscribe` renders the
  three-field inline layout in the SSR HTML (which is exactly where the inline-fix is
  guarded - see Acceptance). The blog surfaces keep the default progressive disclosure.
- **`/subscribe` page.** A Server Component: page-level H1 + invitation copy, then
  `<SubscribeForm source="subscribe_page" alwaysShowName heading={false} />`, then the
  newest post (`getAllPosts()[0]`, cover resolved server-side via `getBlogImage`) as a
  card and a `See all posts` button. Empty content dir -> the Latest-post block is
  omitted.
- **Sitemap.** `/subscribe` is appended explicitly (it is intentionally not in `nav`,
  which drives the header + the rest of the sitemap). A shareable landing page benefits
  from being crawlable, unlike `/projects` (an in-progress stub) or `/privacy` (footer
  utility).

## Acceptance

- [ ] Focusing the email on `/blog` (or a post) reveals the Name field **without** the
      Subscribe button moving on a `sm+` viewport; fields stack below `sm`.
- [ ] `/subscribe` returns 200 with its own `<title>`, the invitation copy, the
      three-field form (name visible), a "Latest post" card linking to the newest post,
      and a "See all posts" link to `/blog`.
- [ ] `/subscribe` is present in `sitemap.xml`; the top nav is unchanged (no Subscribe
      link) and `/projects` stays excluded from the sitemap.
- [ ] Smoke guards: `/subscribe` HTML carries `sm:flex-row sm:items-end` **and**
      `sm:flex-1` (name shown inline); `/blog` carries `sm:flex-row sm:items-end` but
      **not** `sm:flex-1` (name hidden by default). The subscribe conversion event
      (`blog_subscribe_submitted`) still ships in a client chunk.
- [ ] `npm run lint`, `npm test`, and `npm run build` are green.
