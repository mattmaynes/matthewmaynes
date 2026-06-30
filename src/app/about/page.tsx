import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { images, site } from "@/lib/site";
import type { SiteImage } from "@/lib/site";

export const metadata: Metadata = { title: "About" };

const personal: { image: SiteImage; caption: string; position?: string }[] = [
  { image: images.family, caption: "The whole crew." },
  { image: images.sasha, caption: "Sasha, the best dog ever." },
  // Face sits in the upper half of this tall portrait; pin the 4:3 crop to the
  // top so the full face stays on the card.
  { image: images.babyMatthew, caption: "Where it started.", position: "object-top" },
];

export default function AboutPage() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-12 sm:py-16">
      <h1 className="text-h1 font-bold text-text">Hi, I&apos;m Matthew.</h1>
      <div className="mt-6 grid gap-10 lg:grid-cols-[260px_1fr]">
        <div>
          <Image
            src={images.headshot}
            alt={images.headshot.alt}
            sizes="(max-width: 1024px) 60vw, 260px"
            priority
            placeholder="blur"
            className="w-full max-w-xs rounded-lg border border-border object-cover shadow-sm"
          />
        </div>
        <p className="self-center text-body text-text-muted">
          I&apos;m an engineering director who never stopped building. The way I see
          the job is simple: bring the right people and the right technology together
          around a problem, then find the solution that delivers the most value the
          fastest. I lead from the details and default to action. If I&apos;m not
          living the same problem my team is, I have no business giving them advice
          about it.
        </p>
      </div>

      <section className="mt-16">
        <h2 className="text-h2 font-semibold text-text">What I&apos;m actually good at</h2>
        <p className="mt-3 text-body text-text-muted">
          I get obsessed with problems. I like to understand a system all the way down,
          then explain it to someone who has never read a line of code and turn that
          conversation into a problem worth solving. The wins I chase are the creative
          ones: a solution nobody expected that ships real value quickly. That is true
          whether I&apos;m building the thing or coaching the team building it. I spend a
          lot of my time helping people find the one or two behavior changes that
          multiply everything else they do.
        </p>
      </section>

      <section className="mt-16">
        <h2 className="text-h2 font-semibold text-text">A leader who still builds</h2>
        <p className="mt-3 text-body text-text-muted">
          Being a director is a constant negotiation with myself: do this one, or coach
          someone else through it? I lean toward staying close to the work, because
          grounded advice beats theory every time. And the obsession does not switch off
          at the keyboard. When we renovated our last house, I decided the kitchen needed
          new cabinets, so I taught myself to build them - doors and all, having never
          made a cabinet door in my life. That is roughly how I approach most things.
        </p>
      </section>

      <section className="mt-16">
        <h2 className="text-h2 font-semibold text-text">Titles don&apos;t make leaders</h2>
        <p className="mt-3 text-body text-text-muted">
          I don&apos;t put much stock in titles. A leader is anyone who can pull people
          around a problem and find a way through, whether they manage a team or own a
          single ticket. I&apos;d rather be measured by the problems we solved together
          than by the line on an org chart.
        </p>
      </section>

      <section className="mt-16">
        <h2 className="text-h2 font-semibold text-text">Beyond the Code</h2>
        <div className="mt-3 space-y-4 text-body text-text-muted">
          <p>
            When I&apos;m not in the code or the org chart, I&apos;m usually outside. My
            wife Sarah and I live on five acres in rural Ontario with our golden doodle,
            Sasha. We&apos;re slowly reforesting one field, clearing deadfall from
            another, and learning the name of every tree on the property (Sarah is
            winning).
          </p>
          <p>
            In early 2026 we were handed the best problem yet: our daughter, Shea. She
            has rearranged my priorities, my sleep, and my perspective, and the project
            backlog has never been longer. Worth it. The rest of the time you&apos;ll
            find me in the basement gym, on a trail, or losing a board game.
          </p>
        </div>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {personal.map(({ image, caption, position }) => (
            <figure
              key={image.src}
              className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
            >
              <Image
                src={image}
                alt={image.alt}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
                placeholder="blur"
                className={`aspect-[4/3] w-full object-cover ${position ?? ""}`}
              />
              <figcaption className="px-4 py-3 text-caption text-text-muted">
                {caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      <p className="mt-16 text-caption text-text-muted">
        Want the professional detail? The{" "}
        <Link href="/resume" className="text-primary underline-offset-4 hover:underline">
          resume
        </Link>{" "}
        has the full work history. {site.name}, {site.title}, based in {site.location}.
      </p>
    </section>
  );
}
