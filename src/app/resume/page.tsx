import type { Metadata } from "next";
import Image from "next/image";
import { Badge } from "@/components/ui";
import { PagePlaceholder } from "@/components/page-placeholder";
import { images, site } from "@/lib/site";

export const metadata: Metadata = { title: "Resume" };

export default function ResumePage() {
  return (
    <PagePlaceholder
      title="Resume"
      note="A structured resume with real roles, impact, and a downloadable PDF lands in a later spec. The layout and theme are wired up here."
    >
      <div className="flex flex-col gap-8 rounded-lg border border-border bg-surface p-6 shadow-sm sm:flex-row sm:items-center">
        <Image
          src={images.headshot.src}
          alt={images.headshot.alt}
          width={120}
          height={120}
          className="h-28 w-28 rounded-full border border-border object-cover"
        />
        <div className="flex flex-col gap-2">
          <h2 className="text-h3 font-semibold text-text">{site.name}</h2>
          <p className="text-body text-text-muted">
            {site.title} - {site.location}
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            {["Engineering Leadership", "Platform", "Mentorship", "Delivery"].map(
              (skill) => (
                <Badge key={skill} variant="primary">
                  {skill}
                </Badge>
              ),
            )}
          </div>
        </div>
      </div>

      <p className="mt-8 text-body text-text-muted">
        Placeholder: experience, education, and selected work will be listed here.
      </p>
    </PagePlaceholder>
  );
}
