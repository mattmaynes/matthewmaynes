# 0017 - Privacy policy page and footer link

## Problem

The site collects visitor data through two channels - PostHog analytics (pageviews, page
leaves, client/server error tracking, and session replay with masked inputs) and a contact form
relayed by email via Resend - but there is no privacy policy anywhere on the site. Visitors have
no plain-language statement of what is collected, why, who processes it, or how to make a data
request. A personal site this privacy-light (cookieless, self-hosted fonts, no ads, no database)
can state its practices honestly and briefly, and a footer link makes the site feel complete.

## Outcome

When done:

- `/privacy` renders a real, first-person, plain-language privacy policy that accurately matches
  what the site does (PostHog analytics with masked-input session replay, contact form via
  Resend, transient IP use, self-hosted assets, no tracking cookies, no ads, no database).
- The footer shows a `Privacy` link (to `/privacy`) on every page, next to the copyright.
- The policy lists the two data processors (PostHog US, Resend US), the legitimate-interest
  basis for the cookieless analytics, a data-request path, and a `Last updated` date.
- Contact for privacy requests is `privacy@matthewmaynes.com` - a dedicated public address the
  developer has explicitly approved committing, notwithstanding the general no-email rule in
  `CLAUDE.md` (the private inbox address is unaffected and stays server-only).
- Responsive from ~320px up, themed (light/dark) via tokens, ASCII-only per Trellis.

## Scope

**In**

- New `src/app/privacy/page.tsx`: a static Server Component using the shared section/typography
  tokens (`text-h1/h2`, `text-body`, `text-text` / `text-text-muted`), in a prose-width column
  for readability. `export const metadata = { title: "Privacy" }`.
- Footer change (`src/components/footer.tsx`): add a `Privacy` link beside the copyright line.
- Smoke-test coverage (`tests/smoke.test.mjs`): add a `/privacy` route entry asserting the
  route-unique title and a couple of body-unique markers.

**Out** (later / other specs)

- A cookie/consent banner. Analytics is cookieless and localStorage-based; the policy leans on a
  legitimate-interest basis. Opt-in consent for analytics/replay is a possible stricter-GDPR
  follow-up feature, not part of this content page.
- Adding `/privacy` to the header nav or the sitemap. It is a footer/legal link, so it stays out
  of `nav` (which drives both the header and `sitemap.ts`), matching how legal pages are treated.
- Any change to what data is actually collected. This spec documents current behaviour only.

## Approach

- Plain JSX + Tailwind tokens, matching the about/resume pages; no new dependencies, stays a
  Server Component (static content).
- A prose-oriented container (narrower than the 1200px content pages) so the legal text keeps a
  comfortable measure; reuse `text-body` / `text-text-muted` for paragraphs and `text-h2` for
  section headings.
- ASCII-only copy: spaced hyphens (no em/en dashes), straight quotes, Canadian English spelling
  (colour/honour, but -ize) per `docs/rules/` and the blog-post rule in `CLAUDE.md`.
- The privacy email renders only in the `/privacy` body, never in the shared footer, so it does
  not leak onto other routes (the footer link is label-only). This keeps the existing
  `/resume` and `/contact` no-email smoke guards green.

## Content (approved with the developer)

Sections: intro; "The short version"; "Analytics" (PostHog, masked-input session replay, error
reporting, legitimate-interest basis, US processing); "The contact form" (Resend, emailed not
stored, US processing); "IP addresses and server logs" (transient, security/rate-limit, coarse
geo); "What I do not collect" (no ads, no third-party fonts/embeds/CDNs, no account, no
comments); "Your choices and rights" (block analytics, access/copy/delete request); "Children";
"Changes to this policy"; "Contact" (`privacy@matthewmaynes.com`). `Last updated: July 3, 2026`.

## Acceptance

- [ ] `/privacy` renders the sections above, first person, ASCII-only, no placeholder copy.
- [ ] The footer shows a `Privacy` link to `/privacy` on every page; the label carries no email.
- [ ] `privacy@matthewmaynes.com` appears in the `/privacy` body and nowhere else; the existing
      `/resume` and `/contact` no-email smoke guards still pass.
- [ ] Responsive from ~320px up (no horizontal overflow); light and dark themes both read
      cleanly using tokens only (no hard-coded colours).
- [ ] `npm run lint` and `npm run build` pass; `npm test` passes, including a new `/privacy`
      smoke assertion.
- [ ] `features.md` updated to list the privacy page in the reflect step.

## Notes

- Data inventory this policy documents: PostHog (US Cloud; pageviews, page leaves, client/server
  exceptions, session replay with `maskAllInputs`; localStorage, no tracking cookies; gated to
  the live production host) and Resend (US; transactional email for the contact form, no
  database). Fonts/assets self-hosted. See specs 0008 (contact) and 0014/0016 (analytics).
- Public-repo rule: no PII beyond the approved `privacy@` address; location no finer than region.
