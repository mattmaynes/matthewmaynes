# Blog series and the series sash

A **series** groups related posts under a shared name (for example "Life Log") and gives them a
strong visual marker: a diagonal accent **sash** across the top-left corner of the cover, plus a
tinted accent **pill** on listing rows. Use it for an ongoing thread of posts that readers should
recognize as belonging together.

This doc is the how-to for authoring a series post and for the one non-obvious part, reproducing the
sash in an announcement email. Everything else follows the normal blog rules (`CLAUDE.md` carve-out,
`docs/rules/guidelines.md`): Canadian English, no PII, prose plus the known components only, shipped
via an approved PR.

## Marking a post as part of a series

Add a single frontmatter field. That is the whole feature.

```yaml
series: Life Log
```

Absent = a standalone post (no sash, no pill). The value is shown verbatim, so keep the casing you
want to display.

On the site it renders in three places, all driven by that one field (no other edits needed):

- the **cover hero** shows the diagonal sash (`src/components/post-article.tsx`);
- **listing rows** and the **no-cover header** show the accent pill
  (`src/components/post-row.tsx`, `post-article.tsx`);
- the field is threaded loader -> view -> row automatically: `src/lib/blog.ts` parses it,
  `blog-view.ts` (`PostRowData`) and `post-summaries.ts` carry it to the row.

To start a new post, copy the template and fill it in:

```bash
cp docs/templates/blog-series-post.mdx content/blog/<slug>.mdx
```

The filename slug must match the slugified title, or the build fails loudly.

## Media prep (series posts are usually photo/video heavy)

Before committing any image or clip (this is a public repo):

- **Strip metadata, including GPS.** Photos from a phone usually carry no GPS, but **video almost
  always does** - always scan a `.mov`/`.mp4` with `exiftool` and strip it.
- **Rotate upright and convert to sRGB _before_ stripping.** Phone photos are portrait via an EXIF
  Orientation flag and are Display P3. If you only strip metadata you lose the orientation (the image
  renders sideways) and the colour profile (P3 pixels read as sRGB look dull). Bake the rotation into
  the pixels and convert to sRGB, then strip, keeping only the sRGB profile.
- **Compress**, and for video **transcode HEVC to H.264 (yuv420p)** so non-Safari browsers can play
  it; add `-movflags +faststart`.

Then register the assets so the build can resolve them:

- images -> `src/lib/blog-images.ts` (static import + alt); reference with `<PostImage name="..."/>`;
- video -> `src/lib/blog-videos.ts` (src, intrinsic width/height, alt, optional poster); reference
  with `<PostVideo name="..."/>`.

Both components throw on an unknown name, so a typo fails the build rather than shipping a gap.

## The email sash (bake it into the cover)

Email clients drop CSS `transform`, so the site's rotated sash cannot be reproduced with CSS in an
email. Instead **bake the sash into a dedicated cover image** so the visual differentiation survives
everywhere, including Outlook:

1. Render the cover at 2x (for example 1200px wide) with the sash overlay in a headless browser,
   using the same accent ribbon as the site, and screenshot the framed element. The accent tokens are
   ribbon background `#cf9343` on text `#28190d` (Harbor `accent` / `accent-foreground`) - keep these
   in sync with the site sash if the theme changes.
2. Save it as `public/images/blog/<slug>-email-cover.jpg`, strip its metadata, and **commit it** so it
   deploys and the absolute `https://matthewmaynes.com/...` URL resolves before any send.
3. Fill `emails/blog/<slug>.html` from `emails/templates/blog-post-email.html` as usual, but point
   `[[POST_IMAGE_URL]]` at the baked cover, set the eyebrow to `New series - <Series>`, and set the
   tag pills to the post's tags.

Then create and send the campaign with the `ctct` CLI as documented in `emails/README.md`.
