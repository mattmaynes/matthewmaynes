/**
 * Identity source of truth: the person, region, canonical URL, and social links
 * that both the site metadata and the resume PDF render. Split out from site.ts
 * so the resume PDF freshness hash (scripts/generate-resume-pdf.ts) keys on JUST
 * this file - editing the nav or the image map in site.ts no longer flags the
 * committed public/resume.pdf as stale. No PII by design: region only (no street
 * or contact details).
 */

export const identity = {
  name: "Matthew Maynes",
  title: "Engineering Director",
  location: "Ontario, Canada",
  // Canonical site URL, and the resume's website link. Use `||` (not `??`) so an
  // empty-string SITE_URL falls back instead of throwing in new URL("").
  url: process.env.SITE_URL || "https://matthewmaynes.com",
  social: {
    linkedin: "https://www.linkedin.com/in/matthew-maynes/",
    github: "https://github.com/mattmaynes",
    x: "https://x.com/mattmaynes",
    facebook: "https://www.facebook.com/mew.maynes",
    instagram: "https://www.instagram.com/matthew.maynes/",
  },
} as const;

/** Twitter/X handle derived from the profile URL (e.g. "@mattmaynes"). */
export const twitterHandle = `@${new URL(identity.social.x).pathname.replace(/\//g, "")}`;

/** Reduce a profile URL to just its path, without leading/trailing slashes
 *  (e.g. "in/matthew-maynes", "mattmaynes"), for a compact link label; the link
 *  still points at the full URL. Falls back to the hostname if the path is empty,
 *  or the raw string if it will not parse. Shared by the resume and footer. */
export function socialPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\/+|\/+$/g, "") || parsed.hostname;
  } catch {
    return url;
  }
}
