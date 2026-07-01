import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <PagePlaceholder
      title="Projects"
      note="Coming soon: a showcase of the things I've built and shipped."
    />
  );
}
