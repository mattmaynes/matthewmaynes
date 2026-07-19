import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { PostArticle } from "@/components/post-article";
import { type PostNavItem } from "@/components/post-nav";
import { Button } from "@/components/ui";
import {
  getPreviewPosts,
  getPostBySlug,
  getAdjacentPosts,
  isPreviewNow,
  readingMinutes,
} from "@/lib/blog";
import { getBlogImage } from "@/lib/blog-images";
import { COOKIE_NAME, verifySession } from "@/lib/preview-auth";
import { FOCUS_RING as RING } from "@/lib/focus-ring";

type Params = { slug: string };

// This route is DYNAMIC on purpose (it reads the session cookie below): the OG
// metadata is served to EVERYONE so a draft/scheduled link unfurls with the post's
// own card, while the readable BODY is gated behind the preview login (feedback
// 0022). No generateStaticParams/revalidate here - a preview leaves this route
// once it publishes, resolved per request from the content dir.
//
// Intentional topology split (feedback 0022): only THIS per-post page is dynamic
// (its body is cookie-gated). The drafts index (src/app/blog/drafts/page.tsx) and
// the co-located OG-image route stay static/ISR - the index is proxy-gated as a
// whole, and the OG card carries no gated body, so neither needs per-request auth.

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  // Previews are never indexed. A published slug 404s here (it lives at /blog/<slug>).
  const robots = { index: false, follow: false };
  if (!post || !isPreviewNow(post)) return { title: "Blog", robots };
  // Emit the post's real share card so the preview unfurls (Slack/iMessage/etc.)
  // even though the body is gated: the co-located opengraph-image route supplies
  // og:image automatically; noindex keeps it out of search, not out of an unfurl.
  return {
    title: `${post.title} - ${post.draft ? "Draft" : "Scheduled"}`,
    description: post.excerpt,
    robots,
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

export default async function DraftPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  // Only previews (drafts + not-yet-due scheduled posts) live here; a published
  // (or missing) slug 404s so each post is served from exactly one route at any
  // instant (spec 0034/0035).
  if (!post || !isPreviewNow(post)) notFound();

  // Gate the readable BODY: only a valid preview session sees the full post. An
  // unauthenticated visitor (or an unfurler bot) still gets the metadata above and
  // the teaser below, so link previews work without exposing the writing (spec 0036).
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const authed = await verifySession(token, process.env.PREVIEW_PASSWORD);

  if (!authed) {
    const cover = post.coverKey ? getBlogImage(post.coverKey) : undefined;
    const loginHref = `/login?next=${encodeURIComponent(`/blog/drafts/${post.slug}`)}`;
    return (
      <section className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
        <Link
          href="/blog"
          className={`inline-block rounded-sm text-caption text-text-subtle hover:text-primary ${RING}`}
        >
          &larr; All posts
        </Link>
        <p className="mt-6 text-caption font-semibold uppercase tracking-wide text-accent-strong">
          {post.draft ? "Draft preview" : "Scheduled preview"}
        </p>
        <h1 className="mt-2 text-h1 font-bold text-text">{post.title}</h1>
        <p className="mt-4 text-body text-text-muted">{post.excerpt}</p>
        {cover ? (
          // Framed like PostArticle's hero cover (rounded, hairline border), so the
          // teaser matches the full article a logged-in reader sees.
          <div className="mt-8 overflow-hidden rounded-lg border-[0.5px] border-border">
            <Image
              src={cover}
              alt={cover.alt}
              placeholder={cover.pixelated ? "empty" : "blur"}
              sizes="(min-width: 768px) 896px, 100vw"
              className="h-auto w-full"
            />
          </div>
        ) : null}
        <div className="mt-8 rounded-lg border border-border bg-surface p-6">
          <p className="text-body text-text">
            This is a private preview. Log in to read the full post.
          </p>
          <Button asChild className="mt-4">
            <Link href={loginHref}>Log in to read</Link>
          </Button>
        </div>
      </section>
    );
  }

  const minutes = readingMinutes(post);

  // Neighbours among the PREVIEW posts, linking back under /blog/drafts.
  const { previous, next } = getAdjacentPosts(getPreviewPosts(), slug);
  const toNavItem = (p: typeof previous): PostNavItem | null =>
    p
      ? {
          slug: p.slug,
          title: p.title,
          cover: p.coverKey ? getBlogImage(p.coverKey) : undefined,
          minutes: readingMinutes(p),
          tags: p.tags,
          basePath: "/blog/drafts",
        }
      : null;

  return (
    <PostArticle
      post={post}
      previous={toNavItem(previous)}
      next={toNavItem(next)}
      minutes={minutes}
      variant={post.draft ? "draft" : "scheduled"}
    />
  );
}
