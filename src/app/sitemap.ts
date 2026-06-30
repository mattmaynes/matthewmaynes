import type { MetadataRoute } from "next";
import { nav, site } from "@/lib/site";

// Served at /sitemap.xml. Routes come from the same `nav` the header renders,
// so a new page is listed the moment it joins the nav - one source, no drift.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return nav.map((item) => ({
    url: new URL(item.href, site.url).toString(),
    lastModified,
    changeFrequency: "monthly",
    priority: item.href === "/" ? 1 : 0.7,
  }));
}
