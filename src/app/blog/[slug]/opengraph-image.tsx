import { getPublishedPosts, getPostBySlug } from "@/lib/blog";
import { renderPostOgCard, alt, size, contentType } from "../og-card";

// Needs the Node runtime to read the cover + font files off disk.
export const runtime = "nodejs";

export { alt, size, contentType };

// Bake one card per PUBLISHED post at build so this route is static, rather than
// reading content/ per request. Drafts get their own card under /blog/drafts.
export function generateStaticParams() {
  return getPublishedPosts().map((post) => ({ slug: post.slug }));
}

export default async function PostOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return renderPostOgCard(getPostBySlug(slug));
}
