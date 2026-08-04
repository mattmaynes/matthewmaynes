import Image from "next/image";
import Link from "next/link";
import {
  Button,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui";
import { ClockIcon } from "@/components/blog-icons";
import { RssButton } from "@/components/rss-button";
import { PostBody, InlineMdx } from "@/components/post-body";
import { ReadingTimePill } from "@/components/reading-time-pill";
import { SubscribeForm } from "@/components/subscribe-form";
import { PostNav, type PostNavItem } from "@/components/post-nav";
import { formatPostDate } from "@/lib/blog";
import {
  categorySlug,
  tagSlug,
  formatPublishAt,
  postMediaMaxWidth,
  type Category,
} from "@/lib/blog-view";
import { getBlogImage } from "@/lib/blog-images";
import { images, site } from "@/lib/site";
import { FOCUS_RING as RING } from "@/lib/focus-ring";

/**
 * The full post-article body shared by the published route (`/blog/[slug]`) and
 * the draft route (`/blog/drafts/[slug]`), so a draft previews pixel-identically
 * to how it will look once published and the two routes cannot drift (spec 0034).
 *
 * Parameterised by a single `variant` ("published" | "draft" | "scheduled") that
 * drives both the base path (breadcrumb trail, previous/next nav hrefs, "Back
 * to ..." button) and the preview marker banner + subscribe suppression - one
 * prop, so the route base and the preview treatment can never contradict
 * (review: PR #125). A draft and a scheduled post are both previews under
 * /blog/drafts (spec 0035); they differ only in the banner copy.
 *
 * A Server Component (it renders the async `PostBody`/`InlineMdx`), like the
 * routes that use it.
 */

/** The subset of a post this component renders. */
export type ArticlePost = {
  title: string;
  date: string;
  tags: string[];
  /** The post's single category (spec 0038); drives the header category badge. */
  category: Category;
  coverKey?: string;
  coverCaption?: string;
  /** Series this post belongs to (e.g. "Life Log"); drives the corner sash on
   *  the cover hero and the series pill on the no-cover header. */
  series?: string;
  /** ISO 8601 publish time (spec 0035); shown in the "Scheduled for ..." banner
   *  on a scheduled preview. Absent on a published or draft post. */
  publishAt?: string;
  content: string;
};

// Cover-hero header (tags, title, byline). Rendered twice per post: overlaid on
// the image at >= sm, and stacked below the clean image on mobile, where a short
// wide cover leaves no room for a legible overlay. `overlay` flips the colour
// treatment (light-on-image vs default-on-page) and the title size.
function HeroMeta({
  post,
  minutes,
  overlay,
}: {
  post: { title: string; date: string; tags: string[]; category: string };
  minutes: number;
  overlay: boolean;
}) {
  return (
    <>
      {post.tags.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <li key={tag}>
              <Link
                href={`/blog/tags/${tagSlug(tag)}`}
                className={
                  overlay
                    ? `inline-block rounded-full bg-accent px-3 py-1 text-caption font-medium text-accent-foreground hover:bg-accent/90 ${RING}`
                    : `inline-block rounded-full border border-border bg-muted px-3 py-1 text-caption text-secondary hover:border-border-strong hover:text-text ${RING}`
                }
              >
                {tag}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {/* Presentational only. The hero header is rendered TWICE per post - overlaid
          on the cover at >= sm, stacked below it on mobile - and both copies are in
          the HTML at every breakpoint (the inactive one is hidden with `display:
          none`, not omitted). So a styled <h1> here shipped two H1s in the source of
          every post with a cover: `display:none` keeps assistive tech down to one,
          but crawlers and validators parse the markup, not the computed style, and
          they see both. The single semantic <h1> now lives once, just above the
          cover figure.
          These copies must stay aria-hidden: without it the sr-only <h1> and the
          visible copy would both be announced, which is the defect in the other
          direction. */}
      <p
        aria-hidden="true"
        className={
          overlay
            ? "mt-3 text-h1 font-bold text-white"
            : "mt-3 text-h2 font-bold text-text"
        }
      >
        {post.title}
      </p>
      <div
        className={`mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 ${
          overlay ? "text-white/90" : "text-text-subtle"
        }`}
      >
        {/* Category badge (spec 0038): the post's single theme, leading the meta
            row and linking to its archive. A light chip over the dark cover
            overlay, a primary-tinted chip on the plain page. */}
        <Link
          href={`/blog/categories/${categorySlug(post.category)}`}
          className={
            overlay
              ? `inline-flex items-center rounded-full border border-white/40 bg-white/15 px-3 py-1 text-caption font-medium text-white hover:bg-white/25 ${RING}`
              : `inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-caption font-medium text-primary hover:bg-primary/20 ${RING}`
          }
        >
          {post.category}
        </Link>
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

export function PostArticle({
  post,
  previous,
  next,
  minutes,
  variant = "published",
}: {
  post: ArticlePost;
  previous: PostNavItem | null;
  next: PostNavItem | null;
  minutes: number;
  variant?: "published" | "draft" | "scheduled";
}) {
  // A draft and a scheduled post are both not-yet-public previews under
  // /blog/drafts (spec 0035); `isPreview` drives the shared preview treatment
  // (base path, breadcrumb crumb, subscribe suppression, "Back to drafts"),
  // while `isDraft`/`isScheduled` only pick the banner copy.
  const isDraft = variant === "draft";
  const isScheduled = variant === "scheduled";
  const isPreview = isDraft || isScheduled;
  const basePath = isPreview ? "/blog/drafts" : "/blog";
  const cover = post.coverKey ? getBlogImage(post.coverKey) : undefined;
  const pixelated = cover?.pixelated === true;

  return (
    <article className="mx-auto max-w-4xl px-6 py-12 sm:py-16">
      {/* Breadcrumb trail (spec 0022): a persistent way back up to the listing from
          the top of the post. On a preview (draft or scheduled) the trail inserts a
          "Drafts" crumb so it reads Blog / Drafts / Title (spec 0034/0035). */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/blog">Blog</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {isPreview ? (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/blog/drafts">Drafts</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </>
          ) : null}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{post.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {isDraft ? (
        // A clear, unmissable marker that this is an unpublished preview (spec 0034).
        <div
          role="status"
          className="mb-6 flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-caption text-text"
        >
          <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-accent-foreground">
            Draft
          </span>
          <span className="text-text-muted">
            Draft preview - this post is not published and is hidden from the
            blog.
          </span>
        </div>
      ) : null}

      {isScheduled ? (
        // The scheduled counterpart of the draft banner (spec 0035): same
        // treatment, copy that names when the post will go live. It flips onto
        // the public blog on its own at that time.
        <div
          role="status"
          className="mb-6 flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-4 py-3 text-caption text-text"
        >
          <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-accent-foreground">
            Scheduled
          </span>
          <span className="text-text-muted">
            {post.publishAt
              ? `Scheduled for ${formatPublishAt(post.publishAt)} - not published yet and hidden from the blog until then.`
              : "Scheduled - not published yet and hidden from the blog until its time."}
          </span>
        </div>
      ) : null}

      {cover ? (
        // Hero cover. At >= sm the title, tags, and byline overlay the image on a
        // bottom gradient. On mobile a short wide cover has no room for a legible
        // overlay, so the image renders clean and the header stacks below it. The
        // pixel-art cover fills the width and upscales crisply.
        <>
          {/* The page's single semantic heading. It is visually hidden because the
              styled title is drawn per breakpoint by HeroMeta (overlaid on the cover
              on desktop, stacked below it on mobile) and both of those copies are
              presentational (aria-hidden) - see the note there. Do not "simplify"
              this away by promoting one HeroMeta copy back to an <h1>: both copies
              are always present in the markup, so that reinstates the duplicate.
              The no-cover branch below carries its own real <h1> and does not use
              HeroMeta, so it needs nothing here.

              It sits OUTSIDE the <figure> on purpose. A figure with a figcaption is
              exposed as a `figure` role with an accessible name, so a heading jump
              that landed here would drop the reader inside the image group, and
              figure-extracting consumers (reader mode, scrapers) would carry the
              post title off as part of the cover. The title belongs to the document,
              not to the picture. `sr-only` is position:absolute, so hoisting it out
              changes no layout. */}
          <h1 className="sr-only">{post.title}</h1>
          <figure>
            {/* Cap a tall/portrait cover to about an iPhone's height (the shared
              post-media standard), centred, so it does not dominate the screen on
              desktop. A landscape cover is unaffected: postMediaMaxWidth resolves to
              100%, so it stays full column width and the overlaid header still has
              room. */}
            <div
              className="relative mx-auto overflow-hidden rounded-lg border-[0.5px] border-border"
              style={{ maxWidth: postMediaMaxWidth(cover.width, cover.height) }}
            >
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
              {post.series ? (
                // Series sash: a diagonal accent ribbon across the top-left corner
                // of the cover, the strong visual marker that this post belongs to
                // an ongoing series. The parent's `overflow-hidden` clips the band's
                // overhanging ends into a clean corner banner.
                <div className="pointer-events-none absolute -left-16 top-7 z-10 w-56 -rotate-45 bg-accent py-1 text-center text-caption font-semibold uppercase tracking-wider text-accent-foreground shadow-md">
                  {post.series}
                </div>
              ) : null}
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
        </>
      ) : (
        // No cover: fall back to the plain, on-page header treatment.
        <header>
          {post.series ? (
            <span className="mb-3 inline-flex items-center rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-caption font-semibold uppercase tracking-wider text-accent">
              {post.series}
            </span>
          ) : null}
          <h1 className="text-h1 font-bold text-text">{post.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* Category badge (spec 0038), leading the meta row on the no-cover header. */}
            <Link
              href={`/blog/categories/${categorySlug(post.category)}`}
              className={`inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-caption font-medium text-primary hover:bg-primary/20 ${RING}`}
            >
              {post.category}
            </Link>
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
                <li key={tag}>
                  <Link
                    href={`/blog/tags/${tagSlug(tag)}`}
                    className={`inline-block rounded-full border border-border bg-muted px-3 py-1 text-caption text-secondary hover:border-border-strong hover:text-text ${RING}`}
                  >
                    {tag}
                  </Link>
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

      {/* A preview (draft or scheduled) is not a subscribe surface - only published
          posts invite readers to subscribe (spec 0034/0035).
          This suppresses the CHROME block only. An author-placed <PostSubscribe />
          inside the MDX body (spec 0041) still renders on a preview, deliberately:
          it is content, and a preview that hid it would misrepresent the post being
          reviewed. So a preview page shows the in-body block and not this one - that
          asymmetry is intended, not a bug. */}
      {!isPreview ? (
        <SubscribeForm
          source="blog_post"
          className="mt-12 border-t border-border pt-10"
        />
      ) : null}

      <PostNav
        previous={previous}
        next={next}
        className="mt-12 border-t border-border pt-10"
      />

      {/* No comments section here; point readers at a real conversation instead. */}
      <p className="mt-8 text-caption text-text-subtle italic">
        If you are looking for comments, you won&apos;t find them here, but
        I&apos;d still love to hear your opinion.{" "}
        <Link href="/contact" className="text-primary hover:underline">
          Send me an email
        </Link>{" "}
        or message me on social media.
      </p>

      <div className="mt-12 flex flex-wrap items-center gap-3">
        <Button asChild variant="outline">
          <Link href={basePath}>
            {isPreview ? "Back to drafts" : "Back to blog"}
          </Link>
        </Button>
        <RssButton />
      </div>
    </article>
  );
}
