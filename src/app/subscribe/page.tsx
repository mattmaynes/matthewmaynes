import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui";
import { ReadingTimePill } from "@/components/reading-time-pill";
import { SubscribeForm } from "@/components/subscribe-form";
import { getAllPosts, formatPostDate, readingMinutes } from "@/lib/blog";
import { getBlogImage } from "@/lib/blog-images";

export const metadata: Metadata = {
  title: "Subscribe",
  description:
    "Subscribe to Matthew Maynes' mailing list for the occasional update when a new blog post or project ships.",
};

// A focused, shareable landing page for the mailing list (spec 0020). Not in the
// top nav, but the shared header/footer render via the root layout, so the site
// nav is one click away. Listed in the sitemap (see sitemap.ts) so the URL is
// discoverable when shared.
export default function SubscribePage() {
  // The most recent post, shown below the form as "Latest post" so a first-time
  // visitor gets an immediate taste of what they are subscribing to. Cover is
  // resolved server-side (carries its blurDataURL) exactly like the listing.
  const latest = getAllPosts()[0];
  const cover = latest?.coverKey ? getBlogImage(latest.coverKey) : undefined;
  const pixelated = cover?.pixelated === true;

  return (
    <section className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
      <h1 className="text-h1 font-bold text-text">Subscribe</h1>
      <p className="mt-4 text-body-lg text-text-muted">
        Subscribe to my mailing list to hear when I publish a new blog post or launch
        a new project. I will not send you many emails, I promise - just the
        occasional note when there is something worth sharing.
      </p>

      <SubscribeForm
        source="subscribe_page"
        alwaysShowName
        heading={false}
        className="mt-8"
      />

      {latest ? (
        <div className="mt-16 border-t border-border pt-10">
          <h2 className="text-caption font-semibold tracking-wide text-text-subtle uppercase">
            Latest post
          </h2>
          <article className="mt-5 grid gap-5 sm:grid-cols-[200px_1fr]">
            {cover ? (
              <Link
                href={`/blog/${latest.slug}`}
                className="block self-center overflow-hidden rounded-lg border-[0.5px] border-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset focus-visible:outline-none"
              >
                <Image
                  src={cover}
                  alt={cover.alt}
                  sizes="(max-width: 640px) 100vw, 200px"
                  placeholder={pixelated ? "empty" : "blur"}
                  className="aspect-[16/10] w-full object-cover"
                  style={pixelated ? { imageRendering: "pixelated" } : undefined}
                />
              </Link>
            ) : null}
            <div>
              <h3 className="text-h3 font-semibold">
                <Link
                  href={`/blog/${latest.slug}`}
                  className="rounded-sm text-text hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset focus-visible:outline-none"
                >
                  {latest.title}
                </Link>
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <p className="text-caption text-text-subtle">
                  <time dateTime={latest.date}>{formatPostDate(latest.date)}</time>
                </p>
                <ReadingTimePill minutes={readingMinutes(latest)} />
              </div>
              <p className="mt-3 text-body text-text-muted">{latest.excerpt}</p>
            </div>
          </article>

          <div className="mt-8">
            <Button asChild variant="outline">
              <Link href="/blog">See all posts</Link>
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
