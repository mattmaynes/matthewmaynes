import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui";
import { RssIcon, ClockIcon } from "@/components/blog-icons";
import { PostBody, InlineMdx } from "@/components/post-body";
import { ReadingTimePill } from "@/components/reading-time-pill";
import { getAllPosts, getPostBySlug, formatPostDate, readingMinutes } from "@/lib/blog";
import { getBlogImage } from "@/lib/blog-images";
import { images, site, blogFeedTitle } from "@/lib/site";

type Params = { slug: string };

// Statically generate every post at build time (no runtime fetching).
export function generateStaticParams(): Params[] {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Blog" };
  // The per-post opengraph-image.tsx in this route segment supplies the og:image
  // automatically; we set the shareable title/description here.
  return {
    title: `${post.title} - Blog`,
    description: post.excerpt,
    // Autodiscovery: advertise the blog feed from each post's <head> too, so a
    // reader handed a post URL can still find the feed.
    alternates: {
      types: {
        "application/rss+xml": [
          { url: "/blog/feed.xml", title: blogFeedTitle },
        ],
      },
    },
    openGraph: {
      type: "article",
      title: post.title,
      description: post.excerpt,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const cover = post.coverKey ? getBlogImage(post.coverKey) : undefined;
  const pixelated = cover?.pixelated === true;
  const minutes = readingMinutes(post);

  return (
    <article className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
      {cover ? (
        // Hero cover: the title, tags, and byline sit as an overlay on the
        // cover image, over a bottom-anchored gradient that keeps the text
        // legible regardless of the underlying image. The pixel-art cover
        // fills the width and upscales crisply (image-rendering: pixelated).
        <figure>
          <div className="relative overflow-hidden rounded-lg border-[0.5px] border-border">
            <Image
              src={cover}
              alt={cover.alt}
              sizes="(max-width: 896px) 90vw, 896px"
              priority
              placeholder={pixelated ? "empty" : "blur"}
              className="h-auto w-full"
              style={pixelated ? { imageRendering: "pixelated" } : undefined}
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/45 to-transparent px-5 pt-12 pb-5 sm:px-7 sm:pt-16 sm:pb-7">
              {post.tags.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {post.tags.map((tag) => (
                    <li
                      key={tag}
                      className="rounded-full bg-accent px-3 py-1 text-caption font-medium text-accent-foreground"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}
              <h1 className="mt-3 text-h2 font-bold text-white sm:text-h1">{post.title}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-white/90">
                <time dateTime={post.date} className="text-caption">
                  {formatPostDate(post.date)}
                </time>
                <span className="inline-flex items-center gap-1 text-caption">
                  <ClockIcon className="h-3.5 w-3.5" />
                  {minutes} min read
                </span>
                <span className="ml-auto inline-flex items-center gap-2">
                  <span className="text-caption">{`By ${site.name}`}</span>
                  <Image
                    src={images.headshot}
                    alt=""
                    sizes="32px"
                    className="h-8 w-8 rounded-full object-cover ring-1 ring-white/40"
                  />
                </span>
              </div>
            </div>
          </div>
          {post.coverCaption ? (
            // Same caption treatment as an in-body <PostImage>: compile the
            // inline markdown so a link renders, and flatten MDX's wrapping <p>
            // back to caption-sized, subtle text.
            <figcaption className="mt-3 max-w-4xl text-center text-caption text-text-subtle italic [&_p]:m-0 [&_p]:text-caption [&_p]:text-text-subtle">
              <InlineMdx source={post.coverCaption} />
            </figcaption>
          ) : null}
        </figure>
      ) : (
        // No cover: fall back to the plain, on-page header treatment.
        <header>
          <h1 className="text-h1 font-bold text-text">{post.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <p className="text-caption text-text-subtle">
              <time dateTime={post.date}>{formatPostDate(post.date)}</time>
            </p>
            <ReadingTimePill minutes={minutes} />
            <div className="ml-auto flex items-center gap-3">
              <span className="text-caption text-text-muted">{`By ${site.name}`}</span>
              <Image
                src={images.headshot}
                alt=""
                sizes="32px"
                className="h-8 w-8 rounded-full object-cover"
              />
            </div>
          </div>
          {post.tags.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <li
                  key={tag}
                  className="rounded-full border border-border bg-muted px-3 py-1 text-caption text-secondary"
                >
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}
        </header>
      )}

      <div className="mt-10">
        <PostBody source={post.content} />
      </div>

      <p className="mt-10 text-caption text-text-subtle italic">
        The thoughts and views expressed here are my own.
      </p>

      <div className="mt-12 flex flex-wrap items-center gap-3">
        <Button asChild variant="outline">
          <Link href="/blog">Back to blog</Link>
        </Button>
        <Button asChild variant="outline" aria-label="Subscribe to the blog via RSS">
          <a href="/blog/feed.xml">
            <RssIcon className="h-5 w-5" />
            RSS
          </a>
        </Button>
      </div>
    </article>
  );
}
