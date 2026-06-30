# 0006 - Resume PDF: review-caught correctness gaps (spec 0005)

Three **major** findings from the persona review of PR #17 (engineer, architect, tester). All in
the in-sync-PDF machinery - the page content itself was sound. Captured here because each is a
"would do differently" lesson, not a one-off typo.

## Symptom

1. **Stale PDF certified as fresh.** In generate mode the script ran `next build` only when
   `.next/standalone/server.js` was *absent*. A leftover build from an earlier run was reused, so
   headless Chrome could render the *old* resume while the script wrote the *new* source hash - a
   stale `public/resume.pdf` stamped current. The no-drift guarantee silently failed.
2. **Freshness hash had blind spots.** `INPUT_FILES` hashed `resume.ts`, the page, and the print
   CSS - but the page also renders name/title/region/social from `src/lib/site.ts` and embeds the
   headshot image, neither hashed. Editing `site.location` or swapping the photo left the committed
   PDF stale while `resume:pdf:check` stayed green.
3. **Smoke test couldn't tell the real page from the placeholder.** The `/resume` assertions
   checked only the shared `<title>` and a generic `<h1>` - both of which the old `PagePlaceholder`
   also produced. The "no Placeholder badge / real sections" and "no contact PII" acceptance
   criteria had no guard.

## Root cause

A generated, committed artifact is only "in sync" if two things hold: it is rebuilt from current
sources before regeneration, and its freshness key covers *every* input that changes the output.
The script got the freshness *mechanism* right (source hash + sidecar + CI check) but the *inputs*
and the *rebuild step* were incomplete - so the gate guarded a subset of reality. The test gap is a
re-run of feedback 0001: asserting shared chrome (title/h1) instead of what the unit uniquely
produces passes even when the body is wrong.

## Fix

- Generate mode now **always** `next build`s before rendering (it is only reached when regeneration
  is needed), so Chrome never renders a stale page.
- `INPUT_FILES` adds `src/lib/site.ts` and `public/images/headshot.png`; the comment now states the
  list must stay complete.
- The smoke test asserts `/resume` renders unique markers ("How I Lead", "Work History",
  "Certifications"), has dropped the "Placeholder" badge, and contains no email / phone / postal -
  the privacy criterion is now executable, and (since the PDF renders from the page) covers the PDF.
- Minors also addressed: a `timeout` on the Chrome spawn, an OS-assigned free port (no silent
  port-collision hang), a shared `scripts/lib/standalone.mjs` so the standalone-assembly ritual
  isn't duplicated, and readable/underlined link text for the printed PDF.

## Learning

- **A freshness gate for a generated artifact must hash every input that affects the output, and
  regenerate from a clean rebuild - never a cached one.** A gate over a subset of inputs, or one
  that re-renders a stale build, certifies stale output as fresh, which is worse than no gate.
- **When a route graduates from placeholder to real content, its smoke assertion must check
  route-unique body text and the absence of the placeholder marker** - shared title/h1 prove
  nothing (re-application of feedback 0001).
- **Encode a privacy/PII acceptance criterion as an automated assertion**, not human review alone,
  so a future edit can't silently reintroduce contact info on a public site.
