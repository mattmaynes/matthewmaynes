import type { ComponentProps, ReactNode } from "react";
import Image from "next/image";
import { compileMDX } from "next-mdx-remote/rsc";
import { Video } from "@/components/ui";
import { getBlogImage } from "@/lib/blog-images";
import { getBlogVideo } from "@/lib/blog-videos";

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
      <span className="inline-flex max-w-full overflow-hidden rounded-lg border-[0.5px] border-border">
        <Image
          src={image}
          alt={image.alt}
          sizes="(max-width: 640px) 90vw, 640px"
          placeholder={pixelated ? "empty" : "blur"}
          className="h-auto max-w-full"
          style={pixelated ? { imageRendering: "pixelated" } : undefined}
        />
      </span>
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
 * while video.js lazy-loads. A tall portrait clip is capped at 75vh by bounding
 * the wrapper width to `75vh * (w/h)` (never wider than the column), so it never
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
        // Cap a portrait clip at 75vh of height (width = 75vh * aspect), but never
        // wider than the reading column - `min()` takes whichever is smaller.
        style={{
          maxWidth: `min(100%, calc(75vh * ${video.width} / ${video.height}))`,
        }}
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

const components = {
  PostImage,
  PostVideo,
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
 * Compile a short inline-markdown string (e.g. a cover caption) to a ReactNode
 * using the same component map as the post body, so the caption can carry a
 * link. Server-only and compiled over our own tracked frontmatter, never user
 * input - the same trust boundary as PostBody.
 */
export async function InlineMdx({
  source,
}: {
  source: string;
}): Promise<ReactNode> {
  const { content } = await compileMDX({
    source,
    components,
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
