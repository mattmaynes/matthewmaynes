import { getDraftPosts, getPostBySlug } from "@/lib/blog";
import { renderPostOgCard, alt, size, contentType } from "../../og-card";

// Needs the Node runtime to read the cover + font files off disk.
export const runtime = "nodejs";

export { alt, size, contentType };

// Bake one card per DRAFT so a draft previews with the same real card it will
// ship with (spec 0034), instead of the generic site image. A social scraper
// hitting the draft URL still fetches this; `noindex` only affects search
// indexing, not link-preview unfurling.
export function generateStaticParams() {
  return getDraftPosts().map((post) => ({ slug: post.slug }));
}

export default async function DraftOpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return renderPostOgCard(getPostBySlug(slug));
}
