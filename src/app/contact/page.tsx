import type { Metadata } from "next";
import { Button } from "@/components/ui";
import { ContactForm } from "@/components/contact-form";
import {
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  XIcon,
} from "@/components/social-icons";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Contact" };

// Icon-only social links (no channel names), URLs from the single source of
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

      {/* One row of icon-only social links beneath the form. */}
      <div className="mt-12">
        <h2 className="text-caption font-semibold uppercase tracking-wide text-text-subtle">
          Find me elsewhere
        </h2>
        <ul className="mt-4 flex flex-row flex-wrap items-center gap-1">
          {socials.map(({ label, href, Icon }) => (
            <li key={label}>
              {/* Reuse the footer's social button (Canopy ghost icon) so both
                  rows match in size, hover, and focus-visible ring. */}
              <Button
                asChild
                variant="ghost"
                size="icon"
                aria-label={`Matthew Maynes on ${label}`}
              >
                <a href={href} target="_blank" rel="noopener noreferrer">
                  <Icon className="h-5 w-5" />
                </a>
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
