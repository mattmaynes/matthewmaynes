import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Served at /manifest.webmanifest. Gives the site a name, theme color, and
// install icons for "add to home screen" on mobile.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${site.name} - ${site.title}`,
    short_name: site.name,
    description: site.description,
    start_url: "/",
    display: "standalone",
    background_color: "#14222f", // slate-950
    theme_color: "#14222f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
