import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui";
import { PostRow } from "@/components/post-row";
import { SubscribeForm } from "@/components/subscribe-form";
import {
  FacebookIcon,
  GitHubIcon,
  InstagramIcon,
  LinkedInIcon,
  XIcon,
} from "@/components/social-icons";
import { site, images } from "@/lib/site";
import { getPublishedPosts, newPostSlug } from "@/lib/blog";
import { toPostRows } from "@/lib/post-summaries";

export const metadata: Metadata = {
  title: "Links",
  description:
    "The quickest way in: read Matthew Maynes' blog, subscribe for new writing, and find him across social media.",
  alternates: { canonical: "/links" },
};

// Re-render every 60s (shared ISR window, spec 0035) so the "Latest post" card
// picks up a scheduled post on its own once its publishAt passes, with no deploy -
// same treatment as /subscribe.
export const revalidate = 60;

// Evaluated once at module load (build/process start) - the "new as of this build"
// semantics the "New" badge wants; computing Date.now() in render would trip
// react-hooks/purity (learnings 0012). Mirrors the home page's "Latest post".
const NOW_MS = Date.now();

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
  // Rendered through the same `toPostRows` + `PostRow` the home page and /blog
  // listing use, so the summary (excerpt, category, tags, cover, reading time) is
  // pixel-identical here. From the PUBLISHED set so a draft or not-yet-due
  // scheduled post never leaks; the "New" badge is derived over the full set.
  const posts = getPublishedPosts();
  const newSlug = newPostSlug(posts, NOW_MS, 30);
  const latest = toPostRows(posts.slice(0, 1), newSlug)[0] ?? null;

  return (
    <section className="mx-auto px-5 py-8 sm:py-12">
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
          {site.title}{" "}
          {/* Keep the separator glued to the region so it never orphans onto its
              own line on a very narrow phone (the pair wraps as one unit). */}
          <span className="whitespace-nowrap">&middot; {site.location}</span>
        </p>
      </div>

      {/* Links first: the blog + the social channels (the primary asks). */}
      <div className="mt-6 space-y-3 max-w-md mx-auto">
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

      <div className="mt-6 border-t border-border pt-6">
        <div className="max-w-2xl mx-auto">
          <SubscribeForm source="links_page" alwaysShowName />
        </div>
      </div>

      {/* Finally a taste of the latest post - the same rich summary row the home
          page and /blog listing render (excerpt, category, tags, reading time),
          via the shared PostRow so it never drifts from them. */}
      {latest ? (
        <div className="mt-6 border-t border-border pt-6">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-caption font-semibold tracking-wide text-text-subtle uppercase">
              Latest post
            </h2>
            <ul className="mt-3 flex flex-col">
              <PostRow post={latest} />
            </ul>
          </div>
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
