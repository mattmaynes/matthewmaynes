import { notFound } from "next/navigation";
import { getPublishedPosts, getPostBySlug, isPublishedNow } from "@/lib/blog";
import { renderPostOgCard, alt, size, contentType } from "../og-card";

// Needs the Node runtime to read the cover + font files off disk.
export const runtime = "nodejs";

// Re-check the clock every 60s (shared ISR window, spec 0035) so a scheduled
// post's card is available once it becomes due, matching its page going live.
export const revalidate = 60;

export { alt, size, contentType };

// Bake one card per PUBLISHED post at build so this route is static, rather than
// reading content/ per request. Drafts and scheduled posts get their own card
// under /blog/drafts; a scheduled post renders on-demand here once due.
export function generateStaticParams() {
  return getPublishedPosts().map((post) => ({ slug: post.slug }));
}

export default async function PostOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  // Mirror page.tsx: a draft or not-yet-due scheduled post is NOT published at
  // this URL, so its card must not be fetchable here before publishAt (spec 0035;
  // the "Never early / does not leak" guarantee). The not-yet-public card is
  // served under /blog/drafts/<slug>/opengraph-image instead. ISR refreshes this
  // 404 into the real card once the post is due.
  if (!post || !isPublishedNow(post)) notFound();
  return renderPostOgCard(post);
}
