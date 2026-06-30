import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Button } from "@/components/ui";
import { GitHubIcon, LinkedInIcon } from "@/components/social-icons";
import { site } from "@/lib/site";
import { resume } from "@/lib/resume";

export const metadata: Metadata = { title: "Resume" };

/** Reduce a profile URL to just its path (e.g. "/in/matthew-maynes",
 *  "/mattmaynes") for a compact sidebar label; the link still points at the
 *  full URL. Falls back to the raw string if it will not parse. */
function showPath(url: string): string {
  try {
    return new URL(url).pathname.replace(/\/$/, "") || "/";
  } catch {
    return url;
  }
}

export default function ResumePage() {
  return (
    <section className="mx-auto max-w-[1000px] px-6 py-12 sm:py-16 print:py-0">
      {/* Full-width header: identity + actions. No avatar; region + public
          professional links only (no phone/email/address by design). */}
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-h2 font-bold tracking-tight text-text">{site.name}</h1>
          <p className="text-body font-medium text-primary">{site.title}</p>
        </div>
        <div className="flex flex-col gap-1 text-body-sm sm:items-end">
          <span className="text-text-muted">{site.location}</span>
          <Button asChild variant="outline" className="mt-2 print:hidden">
            <a href="/resume.pdf" download>
              Download PDF
            </a>
          </Button>
        </div>
      </header>

      {/* Two columns: a categorical sidebar + the narrative main column. The
          print: variant forces two columns on paper (the md: breakpoint is wider
          than a Letter page, so it would otherwise stack). */}
      <div className="mt-6 grid grid-cols-1 gap-x-10 gap-y-8 md:grid-cols-[34%_1fr] md:gap-x-12 print:grid-cols-[34%_1fr] print:gap-x-8">
        <aside className="flex flex-col gap-6">
          <Section variant="side" title="Skills">
            <p className="text-caption text-text-muted">
              {resume.skills.join(", ")}
            </p>
          </Section>

          <Section variant="side" title="Links">
            <ul className="flex flex-col gap-1.5">
              <li>
                <a
                  href={site.social.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-caption text-primary underline underline-offset-2"
                >
                  <LinkedInIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                  {showPath(site.social.linkedin)}
                </a>
              </li>
              <li>
                <a
                  href={site.social.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-caption text-primary underline underline-offset-2"
                >
                  <GitHubIcon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                  {showPath(site.social.github)}
                </a>
              </li>
            </ul>
          </Section>

          <Section variant="side" title="Software & Tools">
            <dl className="flex flex-col gap-2">
              {resume.tools.map((group) => (
                <div key={group.label}>
                  <dt className="text-caption font-semibold text-text">
                    {group.label}
                  </dt>
                  <dd className="text-caption text-text-muted">{group.items}</dd>
                </div>
              ))}
            </dl>
          </Section>

          <Section variant="side" title="Certifications">
            <ul className="flex flex-col gap-2">
              {resume.certifications.map((cert) => (
                <li key={cert.name} className="text-caption">
                  <span className="block text-text">{cert.name}</span>
                  <span className="text-text-subtle">{cert.date}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section variant="side" title="Education">
            <div className="flex flex-col gap-3">
              {resume.education.map((edu) => (
                <div key={edu.degree}>
                  <p className="text-caption font-semibold text-text">
                    {edu.degree}
                  </p>
                  <p className="text-caption text-text-muted">
                    {edu.school}, {edu.location}
                  </p>
                  <p className="text-caption text-text-subtle">{edu.period}</p>
                </div>
              ))}
            </div>
          </Section>
        </aside>

        <div className="flex flex-col gap-5">
          <p className="text-body-sm leading-snug text-text-muted">
            {resume.summary}
          </p>

          <Section variant="main" title="How I Lead">
            <ul className="flex flex-col gap-1.5">
              {resume.leadership.map((principle) => (
                <li
                  key={principle.lead}
                  className="text-body-sm leading-snug text-text-muted"
                >
                  <span className="font-semibold text-text">
                    {principle.lead}
                  </span>{" "}
                  {principle.body}
                </li>
              ))}
            </ul>
          </Section>

          <Section variant="main" title="Experience">
            <div className="flex flex-col gap-4">
              {resume.work.map((job) => (
                <article
                  key={`${job.company}-${job.period}`}
                  className="break-inside-avoid"
                >
                  <h3 className="text-body-sm font-semibold text-text">
                    {job.title}
                    <span className="font-normal text-text-muted">
                      {" - "}
                      {job.company}
                    </span>
                  </h3>
                  <p className="text-caption text-text-subtle">
                    {job.location} | {job.period}
                  </p>
                  <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4 marker:text-text-subtle">
                    {job.bullets.map((bullet, i) => (
                      <li
                        key={i}
                        className="text-body-sm leading-snug text-text-muted"
                      >
                        {bullet}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </section>
  );
}

/** A titled resume section. `side` headings are smaller (sidebar density);
 *  `main` headings carry the wider narrative column. Both use the uppercase,
 *  primary-tinted, ruled style of a printed resume. */
function Section({
  title,
  variant,
  children,
}: {
  title: string;
  variant: "side" | "main";
  children: ReactNode;
}) {
  // Side sections are short - keep each whole. Main sections (Experience) span
  // pages, so let them break; their jobs carry their own break-inside-avoid and
  // break-after-avoid keeps a heading off a page bottom (cf. feedback 0007).
  // One heading size across columns: same-level headings should match, and a
  // small uppercase eyebrow stays clearly below the job-title size.
  const wrapper = variant === "side" ? "break-inside-avoid" : "";
  return (
    <section className={wrapper}>
      <h2 className="mb-3 break-after-avoid border-b border-border pb-1 text-caption font-semibold uppercase tracking-wider text-primary">
        {title}
      </h2>
      {children}
    </section>
  );
}
