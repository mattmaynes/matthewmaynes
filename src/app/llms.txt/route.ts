import { getPublishedPosts } from "@/lib/blog";
import { buildLlmsTxt } from "@/lib/llms";
import { nav, site } from "@/lib/site";

// Re-bake every 60s (shared ISR window, spec 0035) like the sitemap + feed: the
// site is otherwise static, so a newly published post would not enter llms.txt
// until a deploy. Revalidation re-runs the time-aware getPublishedPosts, so a
// scheduled post appears here on its own at its publishAt (and never before).
// Inlined as a literal because Next requires route segment config to be
// statically analyzable.
export const revalidate = 60;

// Served at /llms.txt (route dir literally named "llms.txt", mirroring
// blog/feed.xml). The pure builder does the markdown assembly + absolute-URL
// joining; this handler just loads the published posts and returns the string as
// text/plain (the llms.txt convention).
export function GET() {
  const posts = getPublishedPosts();
  const body = buildLlmsTxt({
    site,
    nav,
    posts,
  });
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
