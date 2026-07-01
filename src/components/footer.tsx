import { site, socialPath } from "@/lib/site";
import {
  FacebookIcon,
  GitHubIcon,
  InstagramIcon,
  LinkedInIcon,
  XIcon,
} from "@/components/social-icons";

// Every social profile, shown as a column of icon + path links (the resume's
// "Links" treatment: the URL path minus its leading slash, e.g. "mattmaynes").
const socials = [
  { label: "LinkedIn", href: site.social.linkedin, Icon: LinkedInIcon },
  { label: "GitHub", href: site.social.github, Icon: GitHubIcon },
  { label: "X", href: site.social.x, Icon: XIcon },
  { label: "Facebook", href: site.social.facebook, Icon: FacebookIcon },
  { label: "Instagram", href: site.social.instagram, Icon: InstagramIcon },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-surface print:hidden">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center gap-6 px-6 py-8">
        <ul className="flex flex-col gap-1.5">
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
        <p className="text-caption text-text-muted">
          &copy; {new Date().getFullYear()} {site.name}.
        </p>
      </div>
    </footer>
  );
}
