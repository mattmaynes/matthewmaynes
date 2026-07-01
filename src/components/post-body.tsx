import type { ComponentProps, ReactNode } from "react";
import Image from "next/image";
import { compileMDX } from "next-mdx-remote/rsc";
import { getBlogImage } from "@/lib/blog-images";

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
function PostImage({ name }: { name: string }) {
  const image = getBlogImage(name);
  if (!image) return null;
  const pixelated = image.pixelated === true;
  return (
    <figure className="my-8 flex justify-center">
      <span className="inline-flex max-w-full overflow-hidden rounded-lg border border-border bg-slate-950 p-3">
        <Image
          src={image}
          alt={image.alt}
          sizes="(max-width: 640px) 90vw, 640px"
          placeholder={pixelated ? "empty" : "blur"}
          className="h-auto max-w-full"
          style={pixelated ? { imageRendering: "pixelated" } : undefined}
        />
      </span>
    </figure>
  );
}

const components = {
  PostImage,
  h2: (props: ComponentProps<"h2">) => (
    <h2 className="mt-12 text-h2 font-semibold text-text" {...props} />
  ),
  p: (props: ComponentProps<"p">) => (
    <p className="mt-5 text-body leading-relaxed text-text-muted" {...props} />
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
      className="mt-6 border-l-4 border-border-strong pl-4 text-body italic text-text-muted"
      {...props}
    />
  ),
};

export async function PostBody({ source }: { source: string }): Promise<ReactNode> {
  const { content } = await compileMDX({
    source,
    components,
    options: { parseFrontmatter: false },
  });
  return <div className="max-w-2xl">{content}</div>;
}
