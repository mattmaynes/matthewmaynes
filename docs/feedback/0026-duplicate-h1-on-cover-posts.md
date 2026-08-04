# 0026 - Every post with a cover shipped two H1s

## Symptom

A blog post with a cover image rendered **two `<h1>` elements** in its HTML - the same title,
twice. Every published post has a cover, so this was every post on the site.

It was invisible in every way a person would normally notice:

- **On screen** only one title is ever visible, so nothing looked wrong.
- **To a screen reader** only one was ever announced, so audit-by-listening found nothing (see Root
  cause - `display:none` hides the spare from the accessibility tree).
- **In the test suite** the per-route assertion was `assert.match(html, /<h1[\s>]/)` - a *presence*
  check. Two H1s satisfy it exactly as well as one, so it stayed green the whole time.

What it did affect is anything that parses the markup rather than the rendered page: search-engine
crawlers, SEO auditors, and HTML validators all see both headings and have to guess which one is the
document title. On a site whose blog is its main discovery surface, that is worth fixing.

## Root cause

The cover-hero header (`HeroMeta` in `src/components/post-article.tsx`) is deliberately rendered
**twice** per post, because the two layouts are structurally different rather than restylable:

- overlaid on the cover image at `>= sm`, inside the gradient panel;
- stacked **below** the clean image on mobile, where a short wide cover leaves no room for a legible
  overlay.

Both copies are in the markup at every breakpoint. Only one is *displayed*: the inactive one is
switched off with Tailwind's `hidden` / `sm:hidden`, i.e. `display: none`.

`HeroMeta` carried the styled `<h1>`. So the component that renders twice owned the element that
must appear once.

`display: none` is why nobody caught it. It removes an element from the accessibility tree, so
assistive tech only ever reached one H1 - the duplication was real in the markup but silent in the
two channels a human would check. A crawler reads the markup and applies no computed style, so it
saw both.

The no-cover branch was never affected: it renders its own `<h1>` directly and does not use
`HeroMeta`.

## Fix

Move the semantic heading out of the duplicated component:

- `HeroMeta`'s title becomes a presentational `<p aria-hidden="true">`, keeping its `text-h1` /
  `text-h2` styling so nothing changes visually.
- One real `<h1 className="sr-only">` lives in the cover `<figure>`, rendered once.
- `aria-hidden` on the visible copies is **load-bearing**, not decoration: without it the sr-only
  `<h1>` and the visible copy would both be announced, which is the same defect in the other
  direction.

Both comments in the file now say why, and warn against the obvious "simplification" (promoting one
`HeroMeta` copy back to an `<h1>`), which would reinstate the duplicate because both copies are
always present.

The guard changes from presence to **count**: the per-route smoke assertion now requires *exactly
one* `<h1>`. Verified against the running build - each post page returns one, and the title text is
the post's own.

## Learning

**A presence assertion cannot catch a duplication bug - when an element must appear exactly once,
assert the count.** `/<h1[\s>]/` passed on one H1 and on two, so the defect shipped under a green
suite. The general form: a "there must be exactly one X" rule needs `=== 1`, not "at least one";
this applies to landmarks, `<h1>`, canonical links, JSON-LD nodes of a given `@type`, and any other
singleton in a document.

**`display:none` makes a markup defect invisible to both of the channels people audit by hand.** It
removes the element from the accessibility tree, so a screen-reader pass comes back clean, and only
one copy is on screen, so a visual pass comes back clean too. Anything that consumes *markup* -
crawlers, validators, unfurlers, feed readers - still sees everything. When a component is rendered
twice and CSS-switched per breakpoint, audit the **HTML source**, not the rendered page.

**A component rendered more than once must not own a singleton element.** The breakpoint-duplicated
header owning the `<h1>` is the whole bug in one sentence. When duplicating a component for layout
reasons, move anything that must appear once (the heading, an `id`, a landmark role) out to the
single-instance parent first.
