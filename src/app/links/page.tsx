import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui";
import { ReadingTimePill } from "@/components/reading-time-pill";
import { SubscribeForm } from "@/components/subscribe-form";
import {
  FacebookIcon,
  GitHubIcon,
  InstagramIcon,
  LinkedInIcon,
  XIcon,
} from "@/components/social-icons";
import { site, images } from "@/lib/site";
import {
  getPublishedPosts,
  formatPostDate,
  readingMinutes,
} from "@/lib/blog";
import { getBlogImage } from "@/lib/blog-images";

export const metadata: Metadata = {
  title: "Links",
  description:
    "The quickest way in: read Matthew Maynes' blog, subscribe for new writing, and find him across social media.",
};

// Re-render every 60s (shared ISR window, spec 0035) so the "Latest post" card
// picks up a scheduled post on its own once its publishAt passes, with no deploy -
// same treatment as /subscribe.
export const revalidate = 60;

// The five social profiles, largest-reach first, as tappable icon buttons. Mirrors
// the footer's list but sized up for a mobile "link in bio" (spec 0039).
const socials = [
  { label: "LinkedIn", href: site.social.linkedin, Icon: LinkedInIcon },
  { label: "Instagram", href: site.social.instagram, Icon: InstagramIcon },
  { label: "X", href: site.social.x, Icon: XIcon },
  { label: "Facebook", href: site.social.facebook, Icon: FacebookIcon },
  { label: "GitHub", href: site.social.github, Icon: GitHubIcon },
];

// A "link in bio" landing page (spec 0039): one shareable URL for a social-media
// bio. Tight and mobile-first, ordered by intent - the primary LINKS first (blog +
// social channels), then the subscribe ask, then a taste of the latest post.
// Deliberately out of the top nav (a hand-out URL), but in the sitemap. A Server
// Component fully in the SSG HTML; the only client island is the SubscribeForm.
export default function LinksPage() {
  // The most recent published post, shown at the bottom as a taste of the writing.
  // Resolved server-side (the cover carries its blurDataURL) exactly like
  // /subscribe, and from the PUBLISHED set so a draft or not-yet-due scheduled post
  // never leaks.
  const latest = getPublishedPosts()[0];
  const cover = latest?.coverKey ? getBlogImage(latest.coverKey) : undefined;
  const pixelated = cover?.pixelated === true;

  return (
    <section className="mx-auto max-w-md px-5 py-8 sm:py-12">
      {/* Compact identity header - a small avatar, name, and one-line title. Kept
          deliberately minimal so the links below are the focus. */}
      <div className="flex flex-col items-center text-center">
        <Image
          src={images.headshot}
          alt={images.headshot.alt}
          sizes="64px"
          placeholder="blur"
          className="h-16 w-16 rounded-full border border-border object-cover shadow-sm"
        />
        <h1 className="mt-3 text-h3 font-bold text-text">{site.name}</h1>
        <p className="mt-0.5 text-caption text-text-muted">
          {site.title} &middot; {site.location}
        </p>
      </div>

      {/* Links first: the blog + the social channels (the primary asks). */}
      <div className="mt-6 space-y-3">
        <Button asChild size="lg" className="w-full">
          <Link href="/blog">Read the blog</Link>
        </Button>
        <div className="flex items-center justify-center gap-2">
          {socials.map(({ label, href, Icon }) => (
            <Button
              key={label}
              asChild
              variant="outline"
              size="icon"
              className="h-11 w-11"
              aria-label={`Matthew Maynes on ${label}`}
            >
              <a href={href} target="_blank" rel="noopener noreferrer">
                <Icon className="h-5 w-5" />
              </a>
            </Button>
          ))}
        </div>
      </div>

      {/* Then the subscribe ask - the shared subscribe form (spec 0018), attributed
          to this surface via the links_page analytics source. */}
      <div className="mt-6 border-t border-border pt-6">
        <SubscribeForm source="links_page" alwaysShowName />
      </div>

      {/* Finally a taste of the latest post, linking straight into it. */}
      {latest ? (
        <div className="mt-6 border-t border-border pt-6">
          <span className="text-caption font-semibold tracking-wide text-text-subtle uppercase">
            Latest post
          </span>
          <Link
            href={`/blog/${latest.slug}`}
            className="group mt-3 block overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset focus-visible:outline-none"
          >
            {cover ? (
              <Image
                src={cover}
                alt={cover.alt}
                sizes="(max-width: 448px) 100vw, 448px"
                placeholder={pixelated ? "empty" : "blur"}
                className="aspect-[16/9] w-full object-cover"
                style={pixelated ? { imageRendering: "pixelated" } : undefined}
              />
            ) : null}
            <div className="p-4">
              <h2 className="text-body-lg font-semibold text-text group-hover:text-primary">
                {latest.title}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <p className="text-caption text-text-subtle">
                  <time dateTime={latest.date}>{formatPostDate(latest.date)}</time>
                </p>
                <ReadingTimePill minutes={readingMinutes(latest)} />
              </div>
            </div>
          </Link>
        </div>
      ) : null}

      <p className="mt-6 text-center text-caption text-text-subtle">
        <Link
          href="/"
          className="underline-offset-4 hover:text-text hover:underline"
        >
          Explore the whole site
        </Link>
      </p>
    </section>
  );
}
