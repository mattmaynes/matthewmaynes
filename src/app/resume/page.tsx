import type { Metadata } from "next";
import Image from "next/image";
import { Badge, Button } from "@/components/ui";
import { images, site } from "@/lib/site";
import { resume } from "@/lib/resume";

export const metadata: Metadata = { title: "Resume" };

export default function ResumePage() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-12 sm:py-16">
      {/* Header: identity + actions. No phone/email/address by design - just
          region and public professional links. */}
      <header className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Image
            src={images.headshot}
            alt={images.headshot.alt}
            width={120}
            height={120}
            priority
            placeholder="blur"
            className="h-28 w-28 shrink-0 rounded-full border border-border object-cover"
          />
          <div className="flex flex-col gap-2">
            <h1 className="text-h1 font-bold text-text">{site.name}</h1>
            <p className="text-h4 text-text-muted">{site.title}</p>
            <p className="text-body text-text-subtle">{site.location}</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-body">
              <a
                href={site.social.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                LinkedIn
              </a>
              <a
                href={site.social.github}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                GitHub
              </a>
            </div>
          </div>
        </div>

        <Button asChild variant="outline" className="print:hidden">
          <a href="/resume.pdf" download>
            Download PDF
          </a>
        </Button>
      </header>

      <p className="mt-8 max-w-3xl text-body text-text-muted">{resume.summary}</p>

      <ResumeSection title="How I Lead">
        <ul className="flex flex-col gap-3">
          {resume.leadership.map((p) => (
            <li key={p.lead} className="text-body text-text-muted">
              <span className="font-semibold text-text">{p.lead}</span> {p.body}
            </li>
          ))}
        </ul>
      </ResumeSection>

      <ResumeSection title="Skills">
        <div className="flex flex-wrap gap-2">
          {resume.skills.map((skill) => (
            <Badge key={skill} variant="primary">
              {skill}
            </Badge>
          ))}
        </div>
      </ResumeSection>

      <ResumeSection title="Software & Tools">
        <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-[max-content_1fr]">
          {resume.tools.map((group) => (
            <div
              key={group.label}
              className="grid gap-x-8 gap-y-1 sm:col-span-2 sm:grid-cols-subgrid"
            >
              <dt className="text-body font-semibold text-text">
                {group.label}
              </dt>
              <dd className="text-body text-text-muted">{group.items}</dd>
            </div>
          ))}
        </dl>
      </ResumeSection>

      <ResumeSection title="Work History">
        <div className="flex flex-col gap-8">
          {resume.work.map((job) => (
            <article
              key={`${job.company}-${job.period}`}
              className="break-inside-avoid"
            >
              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                <h3 className="text-h4 font-semibold text-text">
                  {job.title}
                  <span className="font-normal text-text-muted"> - {job.company}</span>
                </h3>
                <p className="text-caption text-text-subtle">
                  {job.location} | {job.period}
                </p>
              </div>
              <ul className="mt-3 flex list-disc flex-col gap-2 pl-5">
                {job.bullets.map((bullet, i) => (
                  <li key={i} className="text-body text-text-muted">
                    {bullet}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </ResumeSection>

      <div className="grid gap-12 sm:grid-cols-2">
        <ResumeSection title="Certifications">
          <ul className="flex flex-col gap-3">
            {resume.certifications.map((cert) => (
              <li key={cert.name} className="text-body text-text-muted">
                <span className="text-text-subtle">{cert.date}</span> {cert.name}
              </li>
            ))}
          </ul>
        </ResumeSection>

        <ResumeSection title="Education">
          <div className="flex flex-col gap-4">
            {resume.education.map((edu) => (
              <div key={edu.degree} className="break-inside-avoid">
                <h3 className="text-body font-semibold text-text">{edu.degree}</h3>
                <p className="text-caption text-text-subtle">
                  {edu.school}, {edu.location} | {edu.period}
                </p>
              </div>
            ))}
          </div>
        </ResumeSection>
      </div>
    </section>
  );
}

function ResumeSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 break-inside-avoid">
      <h2 className="mb-4 border-b border-border pb-2 text-h3 font-semibold text-text">
        {title}
      </h2>
      {children}
    </section>
  );
}
