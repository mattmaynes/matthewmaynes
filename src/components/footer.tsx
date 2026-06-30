import { site } from "@/lib/site";
import { Button } from "@/components/ui";
import { GitHubIcon, LinkedInIcon, XIcon } from "@/components/social-icons";

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-surface print:hidden">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <p className="text-caption text-text-muted">
          &copy; {new Date().getFullYear()} {site.name}.
        </p>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" aria-label="Matthew Maynes on LinkedIn">
            <a href={site.social.linkedin} target="_blank" rel="noopener noreferrer">
              <LinkedInIcon className="h-5 w-5" />
            </a>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Matthew Maynes on GitHub">
            <a href={site.social.github} target="_blank" rel="noopener noreferrer">
              <GitHubIcon className="h-5 w-5" />
            </a>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Matthew Maynes on X">
            <a href={site.social.x} target="_blank" rel="noopener noreferrer">
              <XIcon className="h-5 w-5" />
            </a>
          </Button>
        </div>
      </div>
    </footer>
  );
}
