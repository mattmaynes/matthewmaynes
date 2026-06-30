import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Served at /robots.txt. Open to all crawlers; points them at the sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
