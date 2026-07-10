import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FOCUS_RING as RING } from "@/lib/focus-ring";
import { getProjectImage, type ProjectImage } from "@/lib/project-images";
import { getAllProjects } from "@/lib/projects";

/**
 * Stub detail page for a before/after project. Only projects that carry a
 * `beforeCover` get a page; it shows the title, tagline, and the before + after
 * images. These pages are intentionally NOT linked from the grid yet (direct-URL
 * only) - a fuller Phase 2 (story, gallery, cross-links) comes later.
 */
function detailProjects() {
  return getAllProjects().filter((p) => p.beforeCoverKey);
}

export function generateStaticParams() {
  return detailProjects().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = detailProjects().find((p) => p.slug === slug);
  if (!project) return { title: "Projects" };
  return { title: project.title, description: project.tagline };
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = detailProjects().find((p) => p.slug === slug);
  if (!project) notFound();

  const before = getProjectImage(project.beforeCoverKey);
  const after = getProjectImage(project.coverKey);

  return (
    <div className="mx-auto max-w-[900px] px-6 py-16">
      <Link
        href="/projects"
        className={`rounded-sm text-caption text-text-subtle hover:text-primary ${RING}`}
      >
        &larr; Projects
      </Link>
      <h1 className="mt-4 text-h1 font-bold text-text">{project.title}</h1>
      <p className="mt-3 max-w-2xl text-body text-text-muted">{project.tagline}</p>

      <div className="mt-10 grid gap-8 sm:grid-cols-2">
        <Figure label="Before" image={before} />
        <Figure label="After" image={after} />
      </div>
    </div>
  );
}

/** One labelled before/after image, in a uniform framed box. */
function Figure({ label, image }: { label: string; image?: ProjectImage }) {
  if (!image) return null;
  return (
    <figure>
      <figcaption className="mb-2 text-caption font-medium uppercase tracking-wide text-text-subtle">
        {label}
      </figcaption>
      <div
        className={`relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-border ${
          image.fit === "contain" ? "bg-muted-raised" : ""
        }`}
      >
        <Image
          src={image.src}
          alt={image.alt}
          fill
          sizes="(max-width: 640px) 100vw, 450px"
          placeholder={image.blur ? "blur" : "empty"}
          unoptimized={image.unoptimized}
          className={image.fit === "contain" ? "object-contain p-6" : "object-cover"}
        />
      </div>
    </figure>
  );
}
