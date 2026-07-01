import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui";
import { ClockIcon, RssIcon } from "@/components/blog-icons";
import { PostBody } from "@/components/post-body";
import { getAllPosts, getPostBySlug, formatPostDate, readingMinutes } from "@/lib/blog";
import { getBlogImage } from "@/lib/blog-images";
import { images, site } from "@/lib/site";

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
          { url: "/blog/feed.xml", title: `${site.name} - Blog` },
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
    <article className="mx-auto max-w-[1200px] px-6 py-12 sm:py-16">
      <header>
        <h1 className="text-h1 font-bold text-text">{post.title}</h1>
        <div className="mt-4 flex items-center gap-3">
          <Image
            src={images.headshot}
            alt=""
            sizes="32px"
            className="h-8 w-8 rounded-full object-cover"
          />
          <span className="text-caption text-text-muted">{`By ${site.name}`}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-caption text-text-subtle">
            <time dateTime={post.date}>{formatPostDate(post.date)}</time>
          </p>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-3 py-1 text-caption text-text-muted">
            <ClockIcon className="h-3.5 w-3.5" />
            {minutes} min read
          </span>
        </div>
        {post.tags.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-full border border-border bg-muted px-3 py-1 text-caption text-text-muted"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      {cover ? (
        // Match the prose reading measure (max-w-2xl, left-aligned) so the mat
        // aligns with the body column; the pixel-art cover fills the width and
        // upscales crisply (image-rendering: pixelated), not a stamp on a huge mat.
        <div className="mt-8 max-w-2xl overflow-hidden rounded-lg border border-border bg-slate-950 p-4 sm:p-6">
          <Image
            src={cover}
            alt={cover.alt}
            sizes="(max-width: 672px) 90vw, 672px"
            priority
            placeholder={pixelated ? "empty" : "blur"}
            className="h-auto w-full"
            style={pixelated ? { imageRendering: "pixelated" } : undefined}
          />
        </div>
      ) : null}

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
        <Button asChild variant="ghost" aria-label="Subscribe to the blog via RSS">
          <a href="/blog/feed.xml">
            <RssIcon className="h-5 w-5" />
            RSS
          </a>
        </Button>
      </div>
    </article>
  );
}
