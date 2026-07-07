import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Button,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui";
import { RssIcon, ClockIcon } from "@/components/blog-icons";
import { PostBody, InlineMdx } from "@/components/post-body";
import { ReadingTimePill } from "@/components/reading-time-pill";
import { SubscribeForm } from "@/components/subscribe-form";
import { PostNav, type PostNavItem } from "@/components/post-nav";
import {
  getAllPosts,
  getPostBySlug,
  getAdjacentPosts,
  formatPostDate,
  readingMinutes,
} from "@/lib/blog";
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

// Cover-hero header (tags, title, byline). Rendered twice per post: overlaid on
// the image at >= sm, and stacked below the clean image on mobile, where a short
// wide cover leaves no room for a legible overlay. `overlay` flips the colour
// treatment (light-on-image vs default-on-page) and the title size.
function HeroMeta({
  post,
  minutes,
  overlay,
}: {
  post: { title: string; date: string; tags: string[] };
  minutes: number;
  overlay: boolean;
}) {
  return (
    <>
      {post.tags.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <li
              key={tag}
              className={
                overlay
                  ? "rounded-full bg-accent px-3 py-1 text-caption font-medium text-accent-foreground"
                  : "rounded-full border border-border bg-muted px-3 py-1 text-caption text-secondary"
              }
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}
      <h1
        className={
          overlay
            ? "mt-3 text-h1 font-bold text-white"
            : "mt-3 text-h2 font-bold text-text"
        }
      >
        {post.title}
      </h1>
      <div
        className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 ${
          overlay ? "text-white/90" : "text-text-subtle"
        }`}
      >
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
            className={`h-8 w-8 rounded-full object-cover ${
              overlay ? "ring-1 ring-white/40" : ""
            }`}
          />
        </span>
      </div>
    </>
  );
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

  // Chronological neighbours for the previous/next nav (spec 0021). Resolve their
  // covers on the server so each tile carries its blurDataURL, like the listing.
  const { previous, next } = getAdjacentPosts(getAllPosts(), slug);
  const toNavItem = (p: typeof previous): PostNavItem | null =>
    p
      ? {
          slug: p.slug,
          title: p.title,
          cover: p.coverKey ? getBlogImage(p.coverKey) : undefined,
          // Reading time + tags for the tile badges (spec 0023).
          minutes: readingMinutes(p),
          tags: p.tags,
        }
      : null;

  return (
    <article className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
      {/* Breadcrumb trail (spec 0022): a persistent way back up to the listing from
          the top of the post. Canopy's Breadcrumb Twig set, via the ui.ts client
          boundary; BreadcrumbLink `asChild` wraps a Next <Link> so routing stays
          client-side. The post title is the current, non-interactive crumb. The
          trail starts at Blog (not Home) - the listing is the only ancestor a reader
          needs to step back to. */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/blog">Blog</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{post.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {cover ? (
        // Hero cover. At >= sm the title, tags, and byline overlay the image on a
        // bottom gradient. On mobile a short wide cover has no room for a legible
        // overlay, so the image renders clean and the header stacks below it. The
        // pixel-art cover fills the width and upscales crisply.
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
            <div className="absolute inset-x-0 bottom-0 hidden bg-gradient-to-t from-black/80 via-black/45 to-transparent px-7 pt-16 pb-7 sm:block">
              <HeroMeta post={post} minutes={minutes} overlay />
            </div>
          </div>
          {/* Mobile: header below the clean cover, in default on-page colours. */}
          <div className="mt-4 sm:hidden">
            <HeroMeta post={post} minutes={minutes} overlay={false} />
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

      <SubscribeForm source="blog_post" className="mt-12 border-t border-border pt-10" />

      <PostNav
        previous={toNavItem(previous)}
        next={toNavItem(next)}
        className="mt-12 border-t border-border pt-10"
      />

      {/* No comments section here; point readers at a real conversation instead. */}
      <p className="mt-8 text-caption text-text-subtle italic">
        If you are looking for comments, you won&apos;t find them here, but I&apos;d
        still love to hear your opinion.{" "}
        <Link href="/contact" className="text-primary hover:underline">
          Send me an email
        </Link>{" "}
        or message me on social media.
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
