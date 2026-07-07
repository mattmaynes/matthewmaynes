import type { MetadataRoute } from "next";
import { nav, site } from "@/lib/site";

// Routes that are not in the top nav but should still be crawlable/shareable.
// `/subscribe` (spec 0020) is a focused landing page meant to be handed out, so it
// belongs in the sitemap even though it is deliberately kept out of `nav`. (An
// in-progress stub like `/projects` or a footer utility like `/privacy` stays out
// of both by simply not appearing here.)
const EXTRA_ROUTES: readonly string[] = ["/subscribe"];

// Served at /sitemap.xml. Nav routes come from the same `nav` the header renders,
// so a nav page is listed the moment it joins the nav - one source, no drift - plus
// the explicit EXTRA_ROUTES above.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const hrefs = [...nav.map((item) => item.href), ...EXTRA_ROUTES];
  return hrefs.map((href) => ({
    url: new URL(href, site.url).toString(),
    lastModified,
    changeFrequency: "monthly",
    priority: href === "/" ? 1 : 0.7,
  }));
}
