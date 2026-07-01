import type { Metadata } from "next";
import { ContactForm } from "@/components/contact-form";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  XIcon,
} from "@/components/social-icons";
import { site, socialPath } from "@/lib/site";

export const metadata: Metadata = { title: "Contact" };

// Social links shown as icon + URL-path label, URLs from the single source of
// truth. The contact row intentionally omits GitHub (the footer still carries it).
const socials = [
  { label: "LinkedIn", href: site.social.linkedin, Icon: LinkedInIcon },
  { label: "X", href: site.social.x, Icon: XIcon },
  { label: "Facebook", href: site.social.facebook, Icon: FacebookIcon },
  { label: "Instagram", href: site.social.instagram, Icon: InstagramIcon },
];

export default function ContactPage() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-12 sm:py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-h1 font-bold text-text">Contact</h1>
        <p className="max-w-2xl text-body text-text-muted">
          Have a question, an idea, or just want to say hello? Send a note and it
          lands straight in my inbox.
        </p>
      </div>

      {/* Form first, full container width (standard gutters, fluid below). */}
      <div className="mt-10">
        <ContactForm />
      </div>

      {/* Social links beneath the form: a column of icon + URL-path labels (the
          resume "Links" treatment, sharing the socialPath helper). */}
      <div className="mt-12">
        <h2 className="text-caption font-semibold uppercase tracking-wide text-text-subtle">
          Find me elsewhere
        </h2>
        <ul className="mt-4 flex flex-col gap-1.5">
          {socials.map(({ label, href, Icon }) => (
            <li key={label}>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Matthew Maynes on ${label}`}
                className="flex items-center gap-2 text-caption text-primary underline underline-offset-2"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                {socialPath(href)}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
