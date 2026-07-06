# 0013 - Blog subscribe review: an unfailable smoke marker, plus token + log hardening

Feedback from the persona review of PR #65 (spec 0018). One major, several minors,
all folded into the same fix commit.

## Symptom

- **Major (tester):** the `/blog` and `/blog/[slug]` smoke assertions guarded the new
  subscribe block with the bare Tailwind class `"sm:flex-row"`. That utility is also
  emitted by the shared `footer.tsx` (and `blog-list.tsx` on the listing), so it is
  present in the HTML whether or not the subscribe form rendered - the marker could
  not fail. The companion `"Subscribe for updates"` only guarded the `<h2>`, not the
  input/button. So dropping the form, or its responsive layout, would have stayed
  green.
- **Minor (security):** `addContactToList` folded up to 200 chars of Constant
  Contact's `sign_up_form` response body into the thrown Error, which the route logs.
  That endpoint's 4xx bodies can echo the submitted `email_address`, so a subscriber's
  email could reach container logs.
- **Minor (engineer):** a cached access token invalidated upstream before its computed
  TTL (revocation, >60s clock skew, early expiry) had no recovery path - every
  subscribe would 500 until the process restarted.
- **Minor (engineer/architect):** the token cache deduped sequential re-mints but not
  concurrent ones; a cold-start burst still minted N tokens, contrary to its comment.
- **Minor (analytics):** the `blog_subscribe_*` events carried no placement dimension,
  so listing vs. post conversions were indistinguishable.
- **Minor (designer):** the component re-declared a `RING` focus-ring constant that
  Canopy's `Input` already ships, diverging from the sibling contact form.
- **Nit (architect):** after extracting the shared guards into `http-guards.js`, the
  contact route still imported them via a `contact.js` re-export shim, leaving two
  canonical import paths.

## Root cause

- The smoke marker was chosen for what the layout *looks like* (a responsive class)
  rather than what is *unique to the unit* on that route. A utility class is shared
  chrome; it is the classic "assert what the unit uniquely produces" trap this repo
  has hit repeatedly (feedback 0001/0003/0006/0009, learnings 0011). I did not grep
  whether anything else emitted `sm:flex-row` before trusting it as a guard.
- The error-shaping copied the contact core's "status + body slice" pattern without
  accounting for the different upstream: Resend's error body does not carry the
  submitted address, but Constant Contact's `sign_up_form` can.
- The cache modelled the warm, sequential path only; the cold-start-burst and
  stale-token paths were never exercised, so their gaps were invisible.

## Fix

- Smoke markers now anchor on strings **unique to the subscribe form on those
  routes**: the subtext copy `"No spam; unsubscribe anytime."` (proves the form body
  rendered) and `"sm:flex-row sm:items-end"` (the form's own row-container class
  combo, emitted nowhere else on `/blog`, so it guards the responsive layout). The
  comment now explains why.
- `addContactToList` throws **status-only** and attaches `err.status`; no response
  body enters the Error, so no email can reach the logs. A unit test feeds a body
  containing an email and asserts it is absent from the thrown message.
- `submitSubscription` **self-heals once** on a `401`: clear the cache, re-mint, retry
  the add a single time; a second 401 surfaces rather than looping (both tested).
- `createTokenCache` **memoizes the in-flight refresh** so a concurrent cold-cache
  burst shares one mint (tested with N concurrent callers -> one token call).
- The events carry a PII-free `source` (`blog_index` / `blog_post`) dimension.
- Deleted the duplicate `RING` constant (rely on Canopy's built-in ring).
- Dropped the re-export shim: `http-guards.js` is now the single import path; the
  contact route and `contact.test.mjs` import the guards from it directly.

## Learning

Rolled into `overview/learnings.md`: a smoke marker that guards a visual/layout change
must be a string **unique to the unit on that route** - a Tailwind utility shared by
chrome (footer/layout/list) cannot fail. Grep the other components for the class
first, or anchor on unit-unique copy. Also: when copying an error-shaping pattern
across integrations, re-check whether the *new* upstream's error body can contain PII
before logging it.
