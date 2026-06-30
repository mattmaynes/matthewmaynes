import type { Metadata } from "next";
import Image from "next/image";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { PagePlaceholder } from "@/components/page-placeholder";
import { images } from "@/lib/site";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <PagePlaceholder
      title="Projects"
      note="A grid of real projects with tech stacks and write-ups is coming. One card is wired up below to exercise the layout and imagery."
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="overflow-hidden">
          <Image
            src={images.eagleSnap}
            alt={images.eagleSnap.alt}
            sizes="(max-width: 640px) 100vw, 50vw"
            priority
            placeholder="blur"
            className="aspect-[2/1] w-full object-cover"
          />
          <CardHeader>
            <CardTitle>Eagle SNAP</CardTitle>
            <CardDescription>Placeholder project summary.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-body text-text-muted">
              Short description of the project will go here, with what it does and
              the role Matthew played.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {["TypeScript", "Node", "React"].map((tech) => (
                <Badge key={tech}>{tech}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>More to come</CardTitle>
            <CardDescription>Additional projects will appear here.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-body text-text-muted">
              The full project list is loaded from content in a later spec.
            </p>
          </CardContent>
        </Card>
      </div>
    </PagePlaceholder>
  );
}
