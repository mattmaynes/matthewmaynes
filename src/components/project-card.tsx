import Image from "next/image";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ExternalLinkIcon } from "@/components/nav-icons";
import { FOCUS_RING as RING } from "@/lib/focus-ring";
import type { ProjectImage } from "@/lib/project-images";

/**
 * The data a card renders: the project's display fields plus its already-resolved
 * cover (the Server page resolves the cover key via `getProjectImage`, so this
 * component never imports the image registry). `href`, when set, makes the whole
 * card an external link.
 */
export type ProjectCardData = {
  title: string;
  tagline: string;
  tags: string[];
  href?: string;
  cover?: ProjectImage;
};

/** The card body: cover, title, tagline, tag badges. Uniform across sections. */
function CardBody({ project }: { project: ProjectCardData }) {
  const { cover } = project;
  return (
    <Card className="h-full overflow-hidden transition-shadow group-hover:shadow-md">
      {cover ? (
        <div
          className={`relative aspect-[16/10] w-full border-b border-border ${
            cover.fit === "contain" ? "bg-muted" : ""
          }`}
        >
          <Image
            src={cover.src}
            alt={cover.alt}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            placeholder={cover.blur ? "blur" : "empty"}
            unoptimized={cover.unoptimized}
            className={cover.fit === "contain" ? "object-contain p-8" : "object-cover"}
          />
        </div>
      ) : null}
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {project.title}
          {project.href ? (
            <ExternalLinkIcon className="h-4 w-4 shrink-0 text-text-subtle" />
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-body text-text-muted">{project.tagline}</p>
        {project.tags.length > 0 ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {project.tags.map((tag) => (
              <li key={tag}>
                <Badge>{tag}</Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

/**
 * One project card in the grid. Presentational and hook-free, so it renders in
 * the server-rendered listing (and, later, a Phase 2 detail page). When the
 * project has an `href` the whole card is an external link that opens in a new
 * tab, with an arrow affordance beside the title and an sr-only new-tab hint;
 * otherwise it is a plain, non-interactive card (a Phase 2 detail page will make
 * the card link internally instead). The parent grid owns the wrapping layout.
 */
export function ProjectCard({ project }: { project: ProjectCardData }) {
  if (project.href) {
    return (
      <a
        href={project.href}
        target="_blank"
        rel="noopener noreferrer"
        className={`group block h-full rounded-lg ${RING}`}
      >
        <CardBody project={project} />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    );
  }
  return (
    <div className="group h-full">
      <CardBody project={project} />
    </div>
  );
}
