import type { ComponentProps, ReactNode } from "react";
import Image from "next/image";
import { compileMDX } from "next-mdx-remote/rsc";
import { Video } from "@/components/ui";
import { SubscribeForm } from "@/components/subscribe-form";
import { getBlogImage } from "@/lib/blog-images";
import { getBlogVideo } from "@/lib/blog-videos";
import { postMediaMaxWidth } from "@/lib/blog-view";

/**
 * Renders a compiled MDX post body with a Harbor-token prose style. This is a
 * Server Component: `compileMDX` (next-mdx-remote's /rsc entry) compiles the
 * body against React 19 at request/build time, and it only ever compiles our
 * own tracked content/blog/*.mdx - never user input.
 *
 * The component map styles each element with semantic Harbor tokens only
 * (text-text, text-text-muted, border-border, text-primary), so light/dark are
 * both handled with no palette hard-coded here.
 */

/**
 * <PostImage name="..."/> in the MDX -> next/image via the blog-images registry,
 * with the blur placeholder. Pixel-art assets (the Turing cover) render
 * nearest-neighbour and are never blur-upscaled; the in-body flat graphic gets
 * the normal blur treatment.
 */
function PostImage({
  name,
  children,
}: {
  name: string;
  children?: ReactNode;
}) {
  const image = getBlogImage(name);
  // Fail the build loudly on a typo'd/missing image rather than silently
  // dropping it (this compiles at build over our own tracked content only).
  if (!image) {
    throw new Error(`Unknown blog image referenced in MDX: "${name}"`);
  }
  const pixelated = image.pixelated === true;
  return (
    <figure className="my-8 flex flex-col items-center">
      {/* Cap the rendered box to about an iPhone's height (postMediaMaxWidth bounds
          the width to `height-cap * aspect`), centred, so a tall portrait photo or
          phone screenshot lands around phone-sized instead of dominating the page on
          desktop. Landscape images are unaffected (they stay full column width).
          This is the shared site standard, matching the cover hero and PostVideo. */}
      <div
        className="mx-auto overflow-hidden rounded-lg border-[0.5px] border-border"
        style={{ maxWidth: postMediaMaxWidth(image.width, image.height) }}
      >
        <Image
          src={image}
          alt={image.alt}
          sizes="(max-width: 640px) 90vw, 640px"
          placeholder={pixelated ? "empty" : "blur"}
          className="h-auto w-full"
          style={pixelated ? { imageRendering: "pixelated" } : undefined}
        />
      </div>
      {children ? (
        // The caption is authored as MDX children so it can carry inline markdown
        // (a link). MDX wraps that text in a paragraph, which would otherwise pick
        // up the large body-prose <p> style from the component map, so scope the
        // caption type here and flatten any inner <p> back to inline-sized text.
        <figcaption className="mt-3 max-w-2xl text-center text-caption text-text-subtle italic [&_p]:m-0 [&_p]:text-caption">
          {children}
        </figcaption>
      ) : null}
    </figure>
  );
}

/**
 * <PostVideo name="..."/> in the MDX -> Canopy's `Video` Branch (video.js, spec
 * 0070) resolved through the blog-videos registry. Mirrors PostImage: it fails
 * the build loudly on an unknown name (compiled over our own tracked content
 * only). The player is fluid (fills its column and keeps the clip's aspect
 * ratio); `aspectRatio` reserves that ratio up front so there is no layout shift
 * while video.js lazy-loads. A tall portrait clip is capped to the same shared
 * post-media height (`postMediaMaxWidth`) as images and the cover, by bounding the
 * wrapper width to `cap * (w/h)` (never wider than the column), so it never
 * dominates the reading column. The controls are skinned by Canopy's token
 * `video.css` (wired in globals.css) and pick up the Harbor brand automatically.
 * The clips are transcoded to browser-safe H.264 with location metadata stripped
 * before they are registered, so there is no third-party embed and nothing to leak.
 */
function PostVideo({
  name,
  children,
}: {
  name: string;
  children?: ReactNode;
}) {
  const video = getBlogVideo(name);
  if (!video) {
    throw new Error(`Unknown blog video referenced in MDX: "${name}"`);
  }
  return (
    <figure className="my-8 flex flex-col items-center">
      <div
        className="w-full overflow-hidden rounded-lg border-[0.5px] border-border"
        // Cap a portrait clip to the shared post-media height (bounds the width to
        // `cap * aspect`), never wider than the column - the one standard shared with
        // <PostImage> and the cover, so the three media types can't drift apart.
        style={{ maxWidth: postMediaMaxWidth(video.width, video.height) }}
      >
        <Video
          src={video.src}
          poster={video.poster}
          aspectRatio={`${video.width}:${video.height}`}
          preload="metadata"
          aria-label={video.alt}
        />
      </div>
      {children ? (
        <figcaption className="mt-3 max-w-2xl text-center text-caption text-text-subtle italic [&_p]:m-0 [&_p]:text-caption">
          {children}
        </figcaption>
      ) : null}
    </figure>
  );
}

/**
 * <PostSubscribe /> in the MDX -> the mid-article subscribe ask (spec 0041). The
 * end-of-post block only converts readers who finish; this one lets an author put
 * the ask at the moment a reader has decided they like the writing.
 *
 * It takes no props on purpose. Every prop is authoring surface on a component
 * compiled from content, and one consistent block site-wide beats per-post copy.
 *
 * Two deliberate choices make it read as an aside rather than as part of the story:
 *
 * 1. It is an <aside> with an accessible name. That is the element HTML defines for
 *    content tangentially related to the main content, so a screen-reader user gets
 *    a skippable landmark instead of an interruption mid-article.
 * 2. Its title is a styled <p>, NOT a heading, and Canopy's own <h2> is turned off
 *    via heading={false}. A heading here would inject a phantom section into the
 *    post's outline, level-with the author's real headings - misrepresenting the
 *    document structure to heading navigation and to the BlogPosting JSON-LD the
 *    post already emits (spec 0040).
 *
 * The panel styling is semantic Harbor tokens only (the discipline documented at the
 * top of this file), and `my-12` sets it off more than the `my-8` figures do.
 */
function PostSubscribe() {
  return (
    <aside
      aria-label="Subscribe to the blog"
      // border-border-strong, not border-border: `bg-muted` sits only 1.08:1
      // against the light-mode page canvas, so the hairline is doing nearly all the
      // work of separating this from the prose. The stronger token is 1.58:1 there.
      // Dark mode is comfortable either way (1.26:1 fill, 2.07:1 border).
      // md:p-8, not sm:p-8: Canopy's form flips to a single `sm:flex-row` row at
      // 640px while its Input is still 16px, so in the 640-768px band the extra
      // 64px of padding is exactly what clips the revealed "Name (optional)"
      // field. Same shape as feedback 0025 (a breakpoint-driven row in a column
      // narrower than the breakpoint assumes). Widen the padding a step later.
      className="my-12 rounded-lg border border-border-strong bg-muted p-6 md:p-8"
    >
      {/* No font-bold: `text-h4` already carries the token's own semibold weight,
          and overriding it to bold would put this pseudo-title in a HEAVIER face
          than the author's real `text-h2 font-semibold` section headings - an aside
          out-shouting the story it is tucked into. */}
      <p className="text-h4 text-text">Enjoying what you are reading?</p>
      {/* Cadence-free on purpose: the site promises no schedule anywhere else
          ("New posts in your inbox now and then"), and a cadence this blog does not
          keep is a broken expectation - and, for a Canadian sender under CASL, a
          representation worth not making. No no-spam disclaimer either, matching the
          form's own subtext: it protests too much, and Constant Contact puts a real
          unsubscribe link in every message it sends. */}
      <p className="mt-2 max-w-2xl text-body text-text-muted">
        Get new posts in your inbox when I publish them.
      </p>
      {/* heading={false}: the title above replaces Canopy's built-in <h2>. The
          `blog_post_inline` source keeps this placement's conversions separable from
          the end-of-post block's, which is the only way to judge later whether
          carrying both blocks is worth it. */}
      {/* mt-8 matches /subscribe's identical composition. mt-5 is this file's
          paragraph step, which made the form read as one more line of copy. */}
      <SubscribeForm source="blog_post_inline" heading={false} className="mt-8" />
    </aside>
  );
}

const components = {
  PostImage,
  PostVideo,
  PostSubscribe,
  h2: (props: ComponentProps<"h2">) => (
    <h2
      className="mt-12 border-b border-border pb-2 text-h2 font-semibold text-text"
      {...props}
    />
  ),
  p: (props: ComponentProps<"p">) => (
    <p className="mt-5 text-body-lg text-text-muted" {...props} />
  ),
  a: (props: ComponentProps<"a">) => (
    <a
      className="text-primary underline underline-offset-4 hover:text-primary-hover"
      {...props}
    />
  ),
  // The `---` section rules the post uses.
  hr: (props: ComponentProps<"hr">) => (
    <hr className="my-10 border-t border-border" {...props} />
  ),
  strong: (props: ComponentProps<"strong">) => (
    <strong className="font-semibold text-text" {...props} />
  ),
  em: (props: ComponentProps<"em">) => <em className="italic" {...props} />,
  blockquote: (props: ComponentProps<"blockquote">) => (
    <blockquote
      className="mt-6 border-l-4 border-border-strong pl-4 text-body-lg italic text-text-muted"
      {...props}
    />
  ),
};

/**
 * The map for a short inline-markdown string - a cover caption. NOT the body map.
 *
 * A caption is a `<figcaption>`: a phrase about the image above it. The body map
 * carries block-level components that have no business there, and `PostSubscribe`
 * is the sharp case - handed the body map, a caption could render a live `<form>`
 * and a second "Subscribe to the blog" landmark inside a `<figcaption>`. That is
 * invalid-ish nesting, it is wider than the "in a post's MDX body" surface the
 * authoring docs describe, and it would break the premise the smoke markers rest
 * on (that the block's pitch line and landmark occur exactly once on a page).
 *
 * So captions get the inline subset only: the marks a caption legitimately needs.
 * An unregistered capitalized name still throws at compile, so a `<PostSubscribe />`
 * in a caption now fails the build loudly instead of rendering something odd.
 */
const captionComponents = {
  a: components.a,
  strong: components.strong,
  em: components.em,
};

/**
 * Compile a short inline-markdown string (e.g. a cover caption) to a ReactNode,
 * so the caption can carry a link. Server-only and compiled over our own tracked
 * frontmatter, never user input - the same trust boundary as PostBody.
 */
export async function InlineMdx({
  source,
}: {
  source: string;
}): Promise<ReactNode> {
  const { content } = await compileMDX({
    source,
    components: captionComponents,
    options: { parseFrontmatter: false },
  });
  return content;
}

export async function PostBody({ source }: { source: string }): Promise<ReactNode> {
  const { content } = await compileMDX({
    source,
    components,
    options: { parseFrontmatter: false },
  });
  return <div>{content}</div>;
}
