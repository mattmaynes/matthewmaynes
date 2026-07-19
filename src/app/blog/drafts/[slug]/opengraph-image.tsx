import { getPreviewPosts, getPostBySlug } from "@/lib/blog";
import { renderPostOgCard, alt, size, contentType } from "../../og-card";

// Needs the Node runtime to read the cover + font files off disk.
export const runtime = "nodejs";

// Re-check the clock every 60s (shared ISR window, spec 0035) so a scheduled
// post's preview card tracks its page as it moves out of the preview area once due.
export const revalidate = 60;

export { alt, size, contentType };

// Bake one card per PREVIEW post (drafts + scheduled) so a preview shows the same
// real card it will ship with (spec 0034/0035), instead of the generic site
// image. A social scraper hitting the preview URL still fetches this; `noindex`
// only affects search indexing, not link-preview unfurling.
export function generateStaticParams() {
  return getPreviewPosts().map((post) => ({ slug: post.slug }));
}

export default async function DraftOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return renderPostOgCard(getPostBySlug(slug));
}
