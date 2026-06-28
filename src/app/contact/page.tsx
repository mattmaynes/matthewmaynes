import type { Metadata } from "next";
import {
  Button,
  FormField,
  FormFieldControl,
  FormFieldDescription,
  FormFieldLabel,
  Input,
  Textarea,
} from "@/components/ui";
import { PagePlaceholder } from "@/components/page-placeholder";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <PagePlaceholder
      title="Contact"
      note="The quickest way to reach Matthew is via the social links below. The form is a visual placeholder in this build - it does not send anything yet."
    >
      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="text-h3 font-semibold text-text">Find me online</h2>
          <ul className="mt-4 flex flex-col gap-3">
            <li>
              <a
                href={site.social.linkedin}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body text-primary underline-offset-4 hover:underline"
              >
                LinkedIn
              </a>
            </li>
            <li>
              <a
                href={site.social.github}
                target="_blank"
                rel="noopener noreferrer"
                className="text-body text-primary underline-offset-4 hover:underline"
              >
                GitHub
              </a>
            </li>
          </ul>
          <p className="mt-6 text-caption text-text-subtle">
            Based in {site.location}.
          </p>
        </section>

        {/* Visual-only form: disabled inputs and submit so it cannot send. */}
        <section
          aria-label="Contact form (placeholder)"
          className="rounded-lg border border-border bg-surface p-6 shadow-sm"
        >
          <form className="flex flex-col gap-5">
            <FormField disabled>
              <FormFieldLabel>Name</FormFieldLabel>
              <FormFieldControl>
                <Input placeholder="Your name" autoComplete="off" />
              </FormFieldControl>
            </FormField>

            <FormField disabled>
              <FormFieldLabel>Email</FormFieldLabel>
              <FormFieldControl>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="off"
                />
              </FormFieldControl>
              <FormFieldDescription>
                Not collected yet - this field is a placeholder.
              </FormFieldDescription>
            </FormField>

            <FormField disabled>
              <FormFieldLabel>Message</FormFieldLabel>
              <FormFieldControl>
                <Textarea rows={5} placeholder="Say hello..." />
              </FormFieldControl>
            </FormField>

            <Button type="button" disabled className="w-fit">
              Send (coming soon)
            </Button>
          </form>
        </section>
      </div>
    </PagePlaceholder>
  );
}
