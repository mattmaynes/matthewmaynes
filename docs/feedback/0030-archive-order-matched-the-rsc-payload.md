# 0030 - Archive ordering assertions matched the RSC payload, not the rendered list

## Symptom

CI reddened on the first post whose title carries an apostrophe AND shares a tag with an older post
("I've Been Doing This for Years, Why Does It Feel Like Starting Over?", tagged Engineering
Leadership alongside "The Car That Taught Me to Commit and Move On"):

```
expected "Engineering Leadership" archive newest-first:
  "I've Been Doing This for Years..." before "The Car That Taught Me to Commit and Move On"
```

The page was correct. The new post rendered first in the archive, as it should. Only the assertion
was wrong, and it had been wrong for as long as the tests had existed.

## Root cause

`tests/smoke.test.ts` located each post in the fetched HTML with a raw `multiHtml.indexOf(p.title)`.
Two things break that:

1. React escapes apostrophes in text, so the rendered listing row reads `I&#x27;ve Been Doing...`
   and the raw title does not match it.
2. The RSC flight payload at the END of the document repeats every title UNESCAPED, inside
   `<script>`. So `indexOf` did not miss - it silently resolved to the payload copy at byte 51416
   instead of the listing row at 15340, which sorts after the other post's row at 20426.

A raw match therefore reported an ordering that had nothing to do with the rendered order. It passed
for a year only because no title with an apostrophe had yet landed in a tag or category shared with
another post. The same file already knew about both hazards: the single-`<h1>` test strips `<script>`
"so the RSC flight payload cannot contribute" and decodes the entities React emits. That handling had
just never been applied to the archive tests.

## Fix

Added a `visibleText(html)` helper that strips `<script>` blocks and decodes the entities React
emits, and routed the tag and category archive assertions (both the "lists this post" checks and both
newest-first ordering loops) through it. Verified failable: the assertion still reddens if the
archives are reordered oldest-first.

## Learning

**A substring match against a whole HTML document is not an assertion about the rendered page.** Next
serves every string twice, once escaped in the markup and once raw in the flight payload, so a naive
`includes`/`indexOf` can pass on a copy the reader never sees and can order results by where the
serializer happened to put them. Reduce a page to its visible text before asserting on content or
position, and when one test in a file already compensates for an encoding hazard, treat that as a
property of the surface and apply it everywhere the surface is matched - not as a local fix.
