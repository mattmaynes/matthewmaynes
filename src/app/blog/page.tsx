import type { Metadata } from "next";
import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Blog" };

export default function BlogPage() {
  return (
    <PagePlaceholder
      title="Blog"
      note="Posts on engineering, leadership, nature, and life will be listed here. The MDX pipeline and real posts arrive in a later spec, so the list is empty for now."
    >
      <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
        <p className="text-body text-text-muted">No posts yet. Check back soon.</p>
      </div>
    </PagePlaceholder>
  );
}
