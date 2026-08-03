# 0041 - Subscribe visibility: blog-index CTA and an in-post callout

## Problem

The mailing list is the site's only owned channel to reach readers (spec 0018), but on the two
surfaces where a reader is actually reading, the ask is easy to miss:

- **`/blog`** leads with an `h1` and a single **outline RSS button**. RSS is the visually loudest
  subscribe affordance on the page, yet it is the one most readers do not use (0018 Problem says as
  much). The email ask is a block at the very bottom of the listing, below every post row - a reader
  who scans the first few titles and clicks through never sees it.
- **`/blog/[slug]`** puts the subscribe block *after* the body. It converts only readers who finish
  the post. There is no way for an author to place the ask at the natural moment of interest - the
  point mid-article where a reader has decided they like the writing.

Both gaps are placement, not plumbing: `POST /v1/subscribe`, the Constant Contact wiring, the form
component, and the `/subscribe` landing page all already work. This spec adds two placements and one
authoring affordance on top of them.

Because MDX posts are compiled and executed at build (`next-mdx-remote`), a new in-post component is
a **pipeline** change under `src/`, so it follows the full Spectra protocol - not the lightweight
blog-content carve-out in `AGENTS.md`. It also widens the documented component allowlist that the PR
approver checks a post against, so that documentation moves in the same PR.

## Outcome

- **`/blog` header row** carries a **primary "Subscribe" CTA** linking to `/subscribe`, sitting
  beside the existing RSS button. The primary fill makes email the headline action and demotes RSS
  to the secondary outline it already uses, so the two no longer compete.
- **On a very narrow viewport the RSS button collapses to its icon alone** (a square icon button, no
  "RSS" wordmark) so both CTAs and the `Blog` heading stay on one row instead of wrapping. It keeps
  its existing accessible name, so nothing is lost to a screen reader.
- **A new `<PostSubscribe />` component can be dropped into any post's MDX body**, mid-article, and
  renders a subscribe block that reads as an aside rather than as part of the story: a distinct
  tinted, bordered panel with its own pitch ("Enjoying what you are reading?"), the existing no-spam
  reassurance, and a working email form. It takes no props, so an author writes one self-closing tag
  and nothing else.
- The in-post block **does not enter the post's heading outline** and is **not announced as part of
  the article** - it is an `<aside>` with a non-heading title, so the document structure a post
  advertises to search engines and assistive tech is unchanged.
- Subscribes from the in-post block are **attributable separately** in analytics
  (`source: "blog_post_inline"`) from the end-of-post block (`"blog_post"`), so the placement's value
  is measurable rather than assumed.
- Nothing about the existing subscribe surfaces changes: the listing-bottom block, the end-of-post
  block, `/subscribe`, `/links`, and the archives all render exactly as before.

## Scope

**In**

- **`src/app/blog/page.tsx`** - group the header row's actions into a `flex items-center gap-2`
  cluster holding, in order, a primary `Button asChild` to `/subscribe` and the existing outline RSS
  `Button`. The outer row keeps `flex flex-wrap items-center justify-between gap-4`, so on a narrow
  viewport the cluster wraps as a unit under the `h1` rather than splitting.
  - The Subscribe CTA carries `aria-label="Subscribe to the blog by email"`. The visible text
    ("Subscribe") is a prefix of that name, satisfying WCAG 2.5.3 Label in Name, and it disambiguates
    it from the adjacent RSS button whose name already begins "Subscribe to the blog via RSS".
  - The RSS button gains `max-[400px]:w-10 max-[400px]:gap-0 max-[400px]:px-0` and wraps its "RSS"
    text in `<span className="max-[400px]:hidden">`, so below 400px it renders as a square icon
    button. Its `aria-label` is untouched, so the accessible name survives the label being hidden.
- **`src/components/post-body.tsx`** - a new `PostSubscribe` component, registered in the `components`
  map so `<PostSubscribe />` resolves inside a post's MDX. It renders an `<aside>` with an accessible
  name, a tinted/bordered panel, its own title and body copy, and `<SubscribeForm
  source="blog_post_inline" heading={false} />`. Zero props.
- **`src/components/subscribe-form.tsx`** - add `"blog_post_inline"` to the `source` union.
- **Copy** (cadence-free, matching the rest of the site - see Approach):
  - Title: `Enjoying what you are reading?`
  - Body: `Get new posts in your inbox when I publish them.`
- **Drop the no-spam tag-line from every subscribe surface.** The form's subtext loses
  `No spam; unsubscribe anytime.`, leaving `New posts in your inbox now and then.` See Approach for
  why this costs nothing on the consent side. The smoke markers that keyed on the removed sentence
  move to the surviving one, which is still unique to the form body.
- **Roll the block out to the existing posts.** Every published post in `content/blog/` gets a single
  `<PostSubscribe />` after its **second** section (immediately before its third `##` heading). All
  eleven have at least three sections, so none ends up with the block stranded at the foot of the
  post next to the end-of-post form.
- **Docs the PR approver reads** - widen the component allowlist from "`<PostImage>` / `<PostVideo>`"
  to include `<PostSubscribe>` in `AGENTS.md` (both the blog and the series carve-outs reference it),
  `docs/rules/blog-series.md`, and the comment block in `docs/templates/blog-series-post.mdx`.
- **Spec upkeep** (protocol section 2, same PR): note the two new placements in `0018-blog-subscribe.md`
  and the widened component map in `0009-blog-content-pipeline.md`, each pointing at this spec, so
  neither owning spec silently disagrees with the shipped software.
- **Tests**
  - `tests/fixtures/blog/this-is-a-sample-draft.mdx` gains a `<PostSubscribe />` mid-body, so the
    component compiles through the real `next-mdx-remote` pipeline and renders in a real post layout.
    The fixture, not live content, carries it - live posts stay untouched by this pipeline change
    (feedback 0022: fixtures stay out of `content/blog`).
  - Smoke assertions on `/blog` for the CTA and the RSS collapse, and on the drafts preview page for
    the in-post block, each on a **grep-unique, failable** marker (learnings: "assert what the unit
    uniquely produces"). See Approach for the specific markers and why the obvious ones do not work.

**Out**

- ~~Adding `<PostSubscribe />` to a live published post.~~ **Amended: now in scope** (see Scope). It
  was held out as a separate content PR, but the author asked for the rollout in the same change, so
  all eleven published posts carry the block. Placement is mechanical (after the second section), not
  a per-post editorial judgement, which is what made batching it safe.
- **Suppressing the end-of-post subscribe block** when a post uses the in-post one. Two asks on a
  long article is standard newsletter practice and the two read differently (an interstitial nudge
  vs. a closing block); detecting the component in the MDX source before render would need new
  plumbing for no demonstrated gain. Revisit if the data says the second block is dead weight.
- **A Subscribe CTA on the tag (`/blog/tags/[tag]`) and category (`/blog/categories/[slug]`)
  archives.** Those pages carry no RSS button today, so there is no action row to extend; they keep
  their bottom-of-page subscribe block. Adding a header CTA there is a separate, larger change to
  three page headers.
- **Props on `<PostSubscribe />`** (custom copy, a variant). Every prop is authoring surface on a
  component compiled from content, and one consistent block site-wide is the better default. Add one
  only when a post actually needs it.
- **Any change to the subscribe transport, Constant Contact wiring, or `/v1/subscribe`.** This is
  placement and presentation only.

## Approach

**Reuse the shipped form, add only placement.** Both new surfaces render the existing
`SubscribeForm` app wrapper (spec 0018) or link to the existing `/subscribe` page. No new form, no
new route, no new copy for the mechanics - the in-post block passes `heading={false}` and supplies
its own title and pitch above the form, exactly the way `/subscribe` already does. That keeps one
transport, one honeypot, one analytics shape.

**Key decision - the in-post block is an `<aside>` whose title is a `<p>`, not a heading.** Canopy's
`SubscribeForm` renders its built-in title as an `<h2>`. Dropped mid-article that would inject a
phantom `h2` into the post's outline, sitting at the same level as the author's real section
headings and misrepresenting the document structure to search engines (the post already emits
`BlogPosting` JSON-LD, spec 0040) and to assistive-tech heading navigation. So the component passes
`heading={false}` and renders its own title as a styled `<p className="text-h4 ...">`: it looks like
a heading, weighs nothing in the outline. The panel is an `<aside aria-label="Subscribe to the
blog">` - the element HTML defines for content tangentially related to the main content, which is
precisely the "clear it is not part of the story" requirement, and it gives screen-reader users a
skippable landmark rather than an interruption.

**Key decision - visual distinction via the tinted-panel treatment already in the system.** The panel
uses `rounded-lg border border-border bg-muted` with generous padding and `my-12`, all semantic
Harbor tokens (the discipline `post-body.tsx` documents for every mapping). It reads as a distinct
object against the `text-text-muted` prose without introducing a new colour, and `my-12` is a wider
gap than the `my-8` figures use, so it separates from the surrounding paragraphs more than an image
does. No hard-coded palette, no new token.

**Key decision - cadence-free copy.** The block says "Get new posts in your inbox when I publish
them", not "weekly". The site's existing copy deliberately promises no schedule ("New posts in your
inbox now and then"; `/subscribe` says "I will not send you many emails, I promise"), and a weekly
promise the blog does not keep is both a broken expectation and, for a Canadian sender under CASL, a
representation worth not making.

**Key decision - no no-spam disclaimer, anywhere.** "No spam; unsubscribe anytime." reads as
protesting too much, and it buys nothing it is not already paying for elsewhere: Constant Contact
puts a real unsubscribe link in every message it sends, and it owns the consent record. Under CASL
the express consent comes from the visible "Subscribe for updates" intent at the point of signup,
not from a reassurance sentence beside the button, so removing it changes nothing legally. Dropped
from the shared form subtext and never added to the in-post block, so every placement reads the same.

**Key decision - `max-[400px]:` for the RSS collapse, not `sm:`.** The repo's breakpoints are
Tailwind's defaults (no custom `xs`), and `sm` is 640px - hiding the "RSS" label all the way up to
640px would strip it on viewports with room to spare. 400px is just above the common narrow phones
(360px and 375px logical widths) and is where `Blog` + two labelled buttons stop fitting on one row.
An arbitrary variant keeps this a one-line, locally-obvious rule instead of a global theme change.

**Testing - the obvious markers cannot fail, so use these instead.** This is the repo's most-repeated
learning, and both new surfaces have a trap:

- On `/blog`, `href="/subscribe"` is **not** unique: the shared footer links `/subscribe` on every
  page, so that marker stays green with the CTA deleted. Guard on
  `aria-label="Subscribe to the blog by email"` instead, which nothing else emits.
- Likewise `bg-primary text-primary-foreground` is emitted by the active category chip (spec 0038),
  so the primary fill alone proves nothing. The `aria-label` covers presence; the RSS collapse is
  guarded by `max-[400px]:hidden`, a grep-unique string that reddens if the icon-only behaviour is
  reverted.
- For the in-post block, on a **published** post `"Subscribe for updates"` and the shared no-spam
  line also come from the end-of-post form on the same page, so neither can prove the in-post block
  rendered. Guard on the title copy `Enjoying what you are reading?` and on
  `aria-label="Subscribe to the blog"` (the `<aside>` landmark), both unique to this component.
- **Presence is not enough**: assert the block actually contains a form (an `name="email"` input and
  the form's responsive row, both scoped to the `<aside>`), or deleting `<SubscribeForm>` from the
  component ships a bordered box of copy with every marker still green. Assert `blog_post_inline`
  too - it is serialized into the RSC payload, and flipping it to `blog_post` would silently merge
  the two funnels this spec exists to separate.
- The fixture-post assertion runs on the drafts preview route, which the smoke suite already drives
  with an authenticated session, so it exercises the real MDX compile rather than a mocked render.

**Preview pages show the in-post block but not the end-of-post one.** A preview deliberately
suppresses the end-of-post subscribe *chrome* (`post-article.tsx`, specs 0034/0035): a draft is not a
place to collect signups. `<PostSubscribe />` is the opposite case - the author put it in the body,
so a preview that hid it would misrepresent the post being reviewed. Content renders, chrome does
not. The asymmetry is intended, and pinned in both directions by the smoke test.

**Key decision - captions get a narrower component map than the body.** `InlineMdx` compiles the
`coverCaption` frontmatter string and previously reused the body map, so `<PostSubscribe />` would
have been resolvable inside a `<figcaption>` - rendering a live form and a second "Subscribe to the
blog" landmark in a caption, which is wider than the "in a post's body" surface the authoring docs
describe and would break the uniqueness premise the smoke markers rest on. Captions now get an inline
subset (`a`, `strong`, `em`); an unregistered capitalized name still throws at compile, so a
`<PostSubscribe />` in a caption fails the build loudly instead of rendering something odd.

**Analytics.** `source: "blog_post_inline"` is a new value in an existing PII-free dimension - no new
event, no new payload field, nothing about the subscriber. It makes the in-post placement's
conversion separable from the end-of-post block's, which is the only way to judge later whether the
"Out" decision above (keeping both blocks) is right.

The `/blog` CTA is a **link**, not a form, so it needs attribution of its own: `/subscribe`
hard-codes `source="subscribe_page"`, which would leave a CTA-driven signup indistinguishable from a
footer-link, `/links`, shared-URL, or direct visit - and the CTA would inflate that bucket
invisibly. Autocapture is no fallback (the footer emits an `<a>` with the same text and href on every
page). So the CTA links to `/subscribe?from=blog_header`: posthog-js stamps `$current_url` on every
event and the form submits in place via `fetch`, so the existing `blog_subscribe_*` events carry the
param with no new event, no new client component, and no change to the local-suppression gate. The
page never reads `searchParams` and its canonical is already pinned, so ISR and SEO are unaffected.

**`ph-no-capture` restored.** Spec 0018 requires the subscribe form to carry it; the Canopy migration
dropped it (PostHog's `maskAllInputs` was still masking the value, so nothing leaked and no test
failed). This spec puts that input into article bodies, so the class is restored once at the app
wrapper - covering all seven placements - and given a smoke marker so it cannot go missing silently
again.

## Acceptance

- [ ] `/blog` renders a primary Subscribe button linking to `/subscribe` beside the RSS button, in
      the header row with the `Blog` heading; the RSS button keeps its outline variant and its feed
      link. Guarded by the CTA's unique `aria-label`, not by `href="/subscribe"` (which the footer
      also emits on every page).
- [ ] Below a 400px viewport the RSS button renders icon-only (no "RSS" wordmark) and the row does
      not wrap; at 400px and above the wordmark is back. The accessible name
      ("Subscribe to the blog via RSS") is present at every width. Verified in a real browser at
      375px and at desktop, and guarded by a `max-[400px]:hidden` smoke marker.
- [ ] `<PostSubscribe />` in a post's MDX body compiles and renders a tinted, bordered panel with the
      title "Enjoying what you are reading?", the no-spam line, and a working email form, visually
      distinct from the surrounding prose. Exercised through the real `next-mdx-remote` pipeline via
      the draft fixture, and guarded on markers unique to it (the end-of-post form's copy appears on
      the same page and cannot serve as the guard).
- [ ] The in-post block adds **no** heading to the post's outline: its title is not an `h1`-`h6`, and
      the page's heading structure is byte-identical to the same post without the component apart
      from the block's own non-heading markup. It is an `<aside>` with an accessible name.
- [ ] Submitting the in-post form subscribes through the same `POST /v1/subscribe` path as every
      other placement, and fires the PII-free analytics events with `source: "blog_post_inline"`
      (never the address or name). Verified end to end in a browser once before merge.
- [ ] The existing subscribe surfaces are unchanged: the `/blog` bottom block, the end-of-post block,
      `/subscribe`, `/links`, and the tag/category archives all still render their form, and the
      existing smoke markers for each stay green untouched.
- [ ] `AGENTS.md`, `docs/rules/blog-series.md`, and `docs/templates/blog-series-post.mdx` list
      `<PostSubscribe>` in the allowed-component set a post is reviewed against; specs 0018 and 0009
      point at this spec for the new placements and the widened component map.
- [ ] `npm run lint`, `npm run build`, and `npm test` pass.
- [ ] Shipped via an approved PR (no straight-to-main), persona-reviewed, with desktop and mobile
      screenshots of both surfaces attached.
