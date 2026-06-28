import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui";
import { PagePlaceholder } from "@/components/page-placeholder";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug} - Blog` };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;

  return (
    <PagePlaceholder
      title="Blog post"
      note={`This is a placeholder for the post "${slug}". Real posts render from MDX content in a later spec; any slug resolves to this stub for now.`}
    >
      <Button asChild variant="outline">
        <Link href="/blog">Back to blog</Link>
      </Button>
    </PagePlaceholder>
  );
}
