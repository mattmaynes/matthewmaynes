import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ThemeScript } from "@/components/theme-script";
import { images, site, twitterHandle } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} - ${site.title}`,
    template: `%s - ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.name, url: site.url }],
  creator: site.name,
  // Open Graph: the card shown when the link is pasted into iMessage, Slack,
  // LinkedIn, Discord, etc. The image comes from app/opengraph-image.tsx.
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: "en_US",
    url: site.url,
    title: `${site.name} - ${site.title}`,
    description: site.description,
  },
  // Twitter/X large-summary card. The image comes from app/twitter-image.tsx.
  twitter: {
    card: "summary_large_image",
    title: `${site.name} - ${site.title}`,
    description: site.description,
    creator: twitterHandle,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  // Tints mobile browser chrome to the Harbor surface (best-effort: reflects the
  // OS color scheme, not the in-page toggle).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#14222f" },
  ],
};

// Machine-readable identity for search engines and rich results. Mirrors the
// human-facing site constants - one source, no drift.
const personJsonLd = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: site.name,
  url: site.url,
  jobTitle: site.title,
  image: new URL(images.headshot.src, site.url).toString(),
  sameAs: [site.social.linkedin, site.social.github, site.social.x],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="flex min-h-full flex-col bg-bg font-sans text-text">
        <script
          type="application/ld+json"
          // Static, build-time JSON from our own constants - no user input.
          // Escape `<` defensively in case a field ever becomes dynamic, so the
          // payload can never break out of the script element.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(personJsonLd).replace(/</g, "\\u003c"),
          }}
        />
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
