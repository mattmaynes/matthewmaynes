# 0029 - An h3 subheading in a post rendered as plain body text

## Symptom

The first post to use `###` subheadings ("Anyone Can Build It Now") rendered them at 16px / weight
400 with `margin-top: 0` - the same as the paragraph above, and butted straight against it. The
three subsections read as run-on prose, not as a level of structure. Nothing failed: the build was
green, the markup still said `<h3>`, and only a look at the rendered page caught it.

## Root cause

`src/components/post-body.tsx` maps the MDX elements a post uses to styled components, and the map
had entries for `h2`, `p`, `a`, `hr`, `strong`, `em` and `blockquote` - every element the twelve
existing posts had ever used. No post had used `###`, so there was no `h3` entry. An element with
no entry is not an error: MDX renders the bare tag, which the Tailwind preflight reset strips of
size, weight and margin. The gap was invisible for as long as no author reached for the element.

## Fix

Added an `h3` entry (`mt-8 text-h3 font-semibold text-text`) - deliberately quieter than the `h2`
above it, no border rule and a smaller top margin, so the two levels read as a hierarchy.

The sample-draft fixture now carries one of each heading level, and the smoke test asserts both
render WITH their type-scale class. Keying on the class rather than the tag is the point: the tag is
present either way, so only the class distinguishes "styled" from "fell through the map". Verified
failable - removing the `h3` entry reddens the assertion.

## Learning

**A component map keyed to what callers happen to use today silently degrades the first time one
reaches past it.** The failure mode is not an error but a plain-looking render, which no build or
type check catches. When a map translates authored markup into styled output, cover the elements the
authoring surface ALLOWS, not the subset in use, and put one of each in a fixture so the coverage is
asserted rather than assumed.
