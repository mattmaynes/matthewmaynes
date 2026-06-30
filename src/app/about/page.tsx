import type { Metadata } from "next";
import Image from "next/image";
import { PagePlaceholder } from "@/components/page-placeholder";
import { images, site } from "@/lib/site";
import type { SiteImage } from "@/lib/site";

export const metadata: Metadata = { title: "About" };

const personal: { image: SiteImage; caption: string; position?: string }[] = [
  { image: images.family, caption: "Family time outdoors." },
  { image: images.sasha, caption: "Sasha, the best dog ever." },
  // Face sits in the upper half of this tall portrait; pin the 4:3 crop to the
  // top so the full face stays on the card.
  { image: images.babyMatthew, caption: "Where it started.", position: "object-top" },
];

export default function AboutPage() {
  return (
    <PagePlaceholder
      title="About"
      note={`${site.name}, ${site.title} based in ${site.location}. This page will hold the professional story and the personal one. Copy below is placeholder.`}
    >
      <div className="grid gap-10 lg:grid-cols-[260px_1fr]">
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
        <div className="flex flex-col gap-4">
          <h2 className="text-h2 font-semibold text-text">The short version</h2>
          <p className="text-body text-text-muted">
            Engineering leader who still likes to build. Placeholder bio copy will
            describe the path from hands-on engineer to engineering director, the
            kind of teams Matthew likes to grow, and how he leads by example.
          </p>
        </div>
      </div>

      <section className="mt-16">
        <h2 className="text-h2 font-semibold text-text">Beyond the Code</h2>
        <p className="mt-2 max-w-2xl text-body text-text-muted">
          Life outside of work: family, the property, and one very good dog.
        </p>
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
    </PagePlaceholder>
  );
}
