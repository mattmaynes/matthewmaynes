import Link from "next/link";
import { site } from "@/lib/site";
import { Button } from "@/components/ui";
import {
  FacebookIcon,
  GitHubIcon,
  InstagramIcon,
  LinkedInIcon,
  XIcon,
} from "@/components/social-icons";

// Every social profile, shown as icon-only ghost buttons.
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
      <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <p className="text-caption text-text-muted">
          &copy; {new Date().getFullYear()} {site.name}.{" "}
          <Link
            href="/privacy"
            className="underline-offset-4 hover:text-text hover:underline"
          >
            Privacy
          </Link>
          {" "}&middot;{" "}
          <Link
            href="/ai-policy"
            className="underline-offset-4 hover:text-text hover:underline"
          >
            AI Policy
          </Link>
          {" "}&middot;{" "}
          <Link
            href="/subscribe"
            className="underline-offset-4 hover:text-text hover:underline"
          >
            Subscribe
          </Link>
        </p>
        <div className="flex items-center gap-1">
          {socials.map(({ label, href, Icon }) => (
            <Button
              key={label}
              asChild
              variant="ghost"
              size="icon"
              aria-label={`Matthew Maynes on ${label}`}
            >
              <a href={href} target="_blank" rel="noopener noreferrer">
                <Icon className="h-5 w-5" />
              </a>
            </Button>
          ))}
        </div>
      </div>
    </footer>
  );
}
