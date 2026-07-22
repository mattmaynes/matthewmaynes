import Image from "next/image";
import Link from "next/link";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  AboutIcon,
  BlogIcon,
  ContactIcon,
  ProjectsIcon,
  ResumeIcon,
} from "@/components/nav-icons";
import { PostRow } from "@/components/post-row";
import { getPublishedPosts, newPostSlug } from "@/lib/blog";
import { toPostRows } from "@/lib/post-summaries";
import { images, site } from "@/lib/site";

// Re-render every 60s (shared ISR window, spec 0035) so a scheduled post can take
// over the "Latest post" highlight on its own once its publishAt passes - the
// time-aware getPublishedPosts below is re-run each revalidation, with no deploy.
export const revalidate = 60;

// Evaluated once when the route module loads - i.e. build/process start for this
// page, which is the "new as of this build/deploy" semantics the "New" badge
// wants. Computing it inline in render would trip react-hooks/purity (learnings
// 0012).
const NOW_MS = Date.now();

export default function HomePage() {
  // The single most recent post, highlighted below the cards to give a visitor
  // a fresh reason to head into the blog (spec 0029). Resolved server-side (the
  // page is a Server Component) so the row is fully in the SSG HTML, and mapped
  // through the same `toPostRows` + `PostRow` the listing/tag archives use, so
  // it stays pixel-identical to a `/blog` row. `newPostSlug` runs over the full
  // PUBLISHED set so the "New" badge is a whole-corpus fact (learnings 0027) and
  // a draft (spec 0034) is never surfaced here - keep this on getPublishedPosts().
  const posts = getPublishedPosts();
  // Only the newest post is highlighted, so resolve just its cover - but derive
  // the "New" slug from the full published set so the badge stays a whole-corpus
  // fact (learnings 0027), not "newest of the one row we kept".
  const newSlug = newPostSlug(posts, NOW_MS, 30);
  const latest = toPostRows(posts.slice(0, 1), newSlug)[0] ?? null;

  return (
    <>
      {/* Hero: nature photo background with the headshot and intro on top. */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={images.areaILive}
            alt={images.areaILive.alt}
            fill
            priority
            placeholder="blur"
            sizes="100vw"
            // Centered by default (portrait/mobile); nudged up ~50px only in
            // landscape so the focal point sits a touch higher on wide screens.
            className="object-cover landscape:object-[center_calc(50%_-_50px)]"
          />
          <div className="absolute inset-0 bg-overlay/60" />
        </div>

        <div className="relative mx-auto flex max-w-[1200px] flex-col items-start gap-6 px-6 py-20 sm:py-28">
          <div className="flex items-center gap-5">
            <Image
              src={images.headshot}
              alt={images.headshot.alt}
              width={96}
              height={96}
              priority
              placeholder="blur"
              className="h-20 w-20 rounded-full border-2 border-base-white object-cover shadow-lg sm:h-24 sm:w-24"
            />
            <div>
              <p className="text-caption font-medium uppercase tracking-wide text-base-white/80">
                {site.title}
              </p>
              <h1 className="text-display font-bold text-base-white">
                {site.name}
              </h1>
            </div>
          </div>

          <p className="max-w-2xl text-h4 font-normal text-base-white/90">
            {site.tagline}
          </p>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="primary" size="lg">
              <Link href="/about">About me</Link>
            </Button>
            {/* Secondary CTA that pushes the visitor toward the blog (spec 0029).
                A light-bordered, translucent treatment (not a filled variant) so
                it stays clearly subordinate to the filled primary "About me" - two
                saturated solids read as co-equal (design review, spec 0029). White
                border/text to read against the dark hero photo overlay, matching
                the hero's white headshot border and tagline text. */}
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-base-white/70 bg-transparent text-base-white hover:bg-base-white/10 hover:text-base-white"
            >
              <Link href="/blog">Blog</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Intro: who I am and what this site is. */}
      <section className="mx-auto max-w-[1200px] px-6 py-16">
        <p className="text-h4 font-normal text-text">
          I&apos;m Matthew Maynes, an engineering director who never stopped
          building. I lead by pulling the right people and the right technology
          around a problem, then finding the solution that ships the most value
          the fastest - usually from somewhere close to the details.
        </p>
        <p className="mt-4 text-body text-text-muted">
          This site is where the professional and the personal meet: a resume of
          the work, the projects I am proud of, and a blog on engineering,
          leadership, nature, and the occasional detour. Have a look around, and
          if something resonates, say hello.
        </p>
      </section>

      {/* Latest post: highlight the single newest post so the home page gives a
          taste of the blog and a direct path in (spec 0029). Sits directly under
          the intro - above "Around the site" - so the site's most active surface
          leads. Omitted cleanly when there are no posts. */}
      {latest ? (
        <section className="mx-auto max-w-[1200px] border-t border-border px-6 py-16">
          <h2 className="text-h2 font-semibold text-text">Latest post</h2>
          <ul className="mt-8 flex flex-col">
            <PostRow post={latest} />
          </ul>
          <div className="mt-8">
            <Button asChild variant="outline">
              <Link href="/blog">See all posts</Link>
            </Button>
          </div>
        </section>
      ) : null}

      {/* Around the site: quick links to each area. */}
      <section className="mx-auto max-w-[1200px] border-t border-border px-6 py-16">
        <h2 className="text-h2 font-semibold text-text">Around the site</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Order mirrors the nav (About, Resume, Projects, Blog, Contact); Home is omitted. */}
          {[
            { href: "/about", title: "About", note: "The whole person, not just the resume.", Icon: AboutIcon },
            { href: "/resume", title: "Resume", note: "Career history and what I do.", Icon: ResumeIcon },
            { href: "/projects", title: "Projects", note: "The things I have built and shipped.", Icon: ProjectsIcon },
            { href: "/blog", title: "Blog", note: "Engineering, leadership, nature, life.", Icon: BlogIcon },
            { href: "/contact", title: "Contact", note: "Say hello - a note lands in my inbox.", Icon: ContactIcon },
          ].map(({ href, title, note, Icon }) => (
            <Link key={href} href={href} className="group">
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon className="h-5 w-5 shrink-0 text-primary" />
                    {title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-body text-text-muted">{note}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
