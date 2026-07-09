# 0030 - AI Policy page

## Problem

I use AI to help me write. I would rather be transparent about that than let readers
guess. There is no page that says where AI helps and where the line is, so a reader has
no way to know that the ideas, opinions, and experiences here are mine and that AI is
used only as an editor and sounding board.

For: readers of the blog and site who care how the writing is made.

## Outcome

A `/ai-policy` page exists, written in plain first-person prose, that states what AI helps
with (structure, editing, catching mistakes, talking through ideas) and what stays mine
(the ideas, opinions, experiences, and final say). The site footer links to it, placed
between Privacy and Subscribe.

## Scope

**In:**
- New static route `/ai-policy` (`src/app/ai-policy/page.tsx`), mirroring the Privacy page's
  structure, styling, and voice.
- Footer link "AI Policy" inserted between the existing Privacy and Subscribe links.

**Out:**
- Any policy on how AI is used to build the software itself (this page is about the writing).
- Top-nav entry and sitemap entry - like `/privacy`, this is a footer utility, kept out of both.
- Naming specific AI tools or vendors; the wording stays principle-based and evergreen.

## Approach

- Static page, no client JS, no data fetching - same shape as `src/app/privacy/page.tsx`:
  `section` wrapper, `text-h1` heading, `text-text-muted` prose, `mt-12` sections with
  `text-h2` headings and disc lists.
- `<h1>` reads "How I Use AI"; the footer link and page `<title>` metadata read "AI Policy"
  so the footer stays consistent with "Privacy" and "Subscribe".
- Carry a "Last updated" caption like the Privacy page, for parity.
- Content sections: intro, "The short version", "What AI helps with", "What stays mine",
  "Why I am telling you this".
- Canadian English, ASCII-only, no long dashes (repo guidelines).

## Acceptance

- [ ] Visiting `/ai-policy` renders the page with the approved copy.
- [ ] Footer shows Privacy - AI Policy - Subscribe, in that order, linking to `/ai-policy`.
- [ ] Page metadata title is "AI Policy"; `<h1>` is "How I Use AI".
- [ ] Not present in the top nav or the sitemap (parity with `/privacy`).
- [ ] `npm run lint`, `npm run build`, and the test suite pass.
