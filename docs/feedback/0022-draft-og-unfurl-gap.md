# 0022 - Gated draft links unfurled with the generic site card

## Symptom

After the preview login gate (spec 0036) shipped, sharing a draft/scheduled link
(`/blog/drafts/<slug>`) unfurled with the GENERIC site card ("Matthew Maynes - Engineering Director"),
not the post's own cover/title - even though the per-post OG-image route was deliberately left public.
The owner expected the link to preview the post without a password.

## Root cause

An unfurler bot builds the preview from the PAGE's `<head>` (`og:title`/`og:description`/`og:image`),
then follows the `og:image` URL. The proxy gated the whole `/blog/drafts` prefix, so the bot's request
to the page was 307-redirected to `/login`, and it read the LOGIN/site-default `<head>` - it never saw
the draft's `og:image` tag, so the public OG-image route was never discovered. Leaving the image route
public is necessary but NOT sufficient: the page that REFERENCES it must also be readable by the bot.

## Fix

Gate the readable BODY, not the whole route. The proxy now matches only the exact `/blog/drafts` index
(which enumerates all drafts and must not leak). Each `/blog/drafts/<slug>` page is DYNAMIC: its
`generateMetadata` always returns the post's card (public unfurl), and the page reads the session
cookie - authenticated renders the full post, unauthenticated renders a teaser (title + cover) and a
"Log in to read" prompt. Accepted, owner-confirmed tradeoff: a draft's title/excerpt/cover are public
in the unfurl; only the writing is protected. Smoke now asserts a no-cookie preview page returns the
post's own `og:title` (not the site default) plus the login prompt, with the body gated.

Also separated the test fixtures from live content: the sample draft + scheduled posts moved to
`tests/fixtures/blog`, injected via a `BLOG_FIXTURES_DIR` env the loader reads alongside `content/blog`
(the `npm test` script sets it absolute). Removing the sample posts from `content/blog` no longer guts
the smoke/unit coverage, and no placeholder post appears on the live site. CI needs the env on BOTH the
`npm run build` AND `npm test` steps in `verify.yml`, because the smoke `before()` hook REUSES the
standalone artifact the earlier build step produced - a fixture-less build there would serve a
fixture-less index to the smoke suite. The DEPLOYED image is built separately by the Dockerfile, which
never sets `BLOG_FIXTURES_DIR`, so it stays fixture-free.

## Learning

Two generalise (rolled into `overview/learnings.md`):
- **Gating a whole route at the proxy also hides its OG metadata from unfurlers.** If a page must both
  be access-controlled AND produce a link preview, serve the metadata publicly and gate only the body
  (a page-level cookie check), because a crawler reads the page `<head>`, not a separate image route.
- **Keep test fixtures out of live content.** When a loader reads a single content dir used by both
  prod and tests, sample fixtures leak onto the live site; inject an extra fixtures dir via an env the
  loader reads only in tests, so removing samples from live content does not gut coverage.
