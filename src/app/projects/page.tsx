import type { Metadata } from "next";
import { ProjectCard } from "@/components/project-card";
import { getProjectImage } from "@/lib/project-images";
import { getAllProjects } from "@/lib/projects";
import { groupByCategory } from "@/lib/projects-view";

export const metadata: Metadata = {
  title: "Projects",
  description:
    "Things Matthew Maynes has built and shipped - professional work, open-source tooling, and hands-on builds.",
};

/**
 * The projects grid: three curated sections (Work -> Tinkering -> Making), each
 * a heading over a responsive grid of uniform cards. A Server Component - the
 * projects are grouped and sorted in the fs-free view core, covers are resolved
 * server-side, so the whole page is static in the SSG HTML (spec 0031). Empty
 * sections are dropped by `groupByCategory`, so no heading renders without cards.
 */
export default function ProjectsPage() {
  const sections = groupByCategory(getAllProjects());

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-16">
      <h1 className="text-h1 font-bold text-text">Projects</h1>
      <p className="mt-4 max-w-2xl text-body text-text-muted">
        The things I have built and shipped - the professional work, the tools I
        tinker on, and the things I make away from a keyboard.
      </p>

      {sections.map((section) => (
        <section key={section.key} className="mt-16">
          <h2 className="text-h2 font-semibold text-text">{section.label}</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {section.projects.map((project) => (
              <ProjectCard
                key={project.slug}
                project={{
                  title: project.title,
                  tagline: project.tagline,
                  tags: project.tags,
                  href: project.href,
                  cover: getProjectImage(project.coverKey),
                }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
