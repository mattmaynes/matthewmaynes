import Image from "next/image";
import Link from "next/link";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import {
  AboutIcon,
  BlogIcon,
  ContactIcon,
  ResumeIcon,
} from "@/components/nav-icons";
import { images, site } from "@/lib/site";

export default function HomePage() {
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
          </div>
        </div>
      </section>

      {/* Quick links into the rest of the (still placeholder) site. */}
      <section className="mx-auto max-w-[1200px] px-6 py-16">
        <h2 className="text-h2 font-semibold text-text">Around the site</h2>
        <p className="mt-2 max-w-2xl text-body text-text-muted">
          This is the walking skeleton. The structure, theme, and images are real;
          the words are placeholders until each section is written.
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {/* Order mirrors the nav (About, Resume, Blog, Contact); Home is omitted. */}
          {[
            { href: "/about", title: "About", note: "The whole person, not just the resume.", Icon: AboutIcon },
            { href: "/resume", title: "Resume", note: "Career history and what I do.", Icon: ResumeIcon },
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
