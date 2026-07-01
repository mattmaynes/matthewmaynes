"use client";

import { useState } from "react";
import { usePostHog } from "posthog-js/react";
import { clientAnalyticsEnabled } from "@/lib/posthog-browser";
import {
  Button,
  FormField,
  FormFieldControl,
  FormFieldLabel,
  Input,
  Textarea,
} from "@/components/ui";

/**
 * The live contact form. A `"use client"` island (Canopy inputs cross the client
 * boundary via `@/components/ui`, per overview/learnings) that posts JSON to
 * `POST /v1/contact` and reflects submitting / success / error state. The
 * destination address lives only in server env behind that route - nothing here
 * knows it. A hidden honeypot field (`company`) catches naive bots.
 */
type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function ContactForm() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const posthog = usePostHog();

  // Track the site's core conversion as explicit, PII-FREE events (spec 0014):
  // the form is `ph-no-capture`, so autocapture never sees the submit and the
  // funnel would otherwise be invisible. We send no field values - only the
  // outcome - so no name/email/message ever reaches PostHog. Gated so local runs
  // stay off the live dashboard (spec 0016).
  const track = (event: string, properties?: Record<string, unknown>) => {
    if (clientAnalyticsEnabled()) posthog?.capture(event, properties);
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus({ kind: "submitting" });
    track("contact_form_submitted");
    try {
      const res = await fetch("/v1/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          message: data.get("message"),
          company: data.get("company"), // honeypot
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.ok) {
        form.reset();
        setStatus({ kind: "success" });
        track("contact_form_succeeded");
      } else {
        setStatus({
          kind: "error",
          message:
            typeof json?.error === "string"
              ? json.error
              : "Something went wrong. Please try again.",
        });
        track("contact_form_failed", { reason: `http_${res.status}` });
      }
    } catch {
      setStatus({
        kind: "error",
        message: "Could not reach the server. Please try again.",
      });
      track("contact_form_failed", { reason: "network" });
    }
  }

  const submitting = status.kind === "submitting";

  return (
    // `ph-no-capture` masks this whole subtree in PostHog session replay and
    // keeps its inputs out of autocapture (spec 0014) - belt-and-suspenders atop
    // the global maskAllInputs, so a message body can never enter a recording.
    <form
      onSubmit={handleSubmit}
      className="ph-no-capture flex flex-col gap-5"
      noValidate
    >
      <FormField>
        <FormFieldLabel>Name</FormFieldLabel>
        <FormFieldControl>
          <Input
            name="name"
            placeholder="Your name"
            autoComplete="name"
            required
            maxLength={100}
          />
        </FormFieldControl>
      </FormField>

      <FormField>
        <FormFieldLabel>Email</FormFieldLabel>
        <FormFieldControl>
          <Input
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            required
            maxLength={200}
          />
        </FormFieldControl>
      </FormField>

      <FormField>
        <FormFieldLabel>Message</FormFieldLabel>
        <FormFieldControl>
          <Textarea
            name="message"
            rows={6}
            placeholder="Say hello..."
            required
            maxLength={5000}
          />
        </FormFieldControl>
      </FormField>

      {/* Honeypot: hidden from users and assistive tech; a naive bot that fills
          every input trips it and the server drops the message silently. */}
      <div className="hidden" aria-hidden>
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Button type="submit" disabled={submitting} className="w-fit">
          {submitting ? "Sending..." : "Send"}
        </Button>
        {status.kind === "success" && (
          <p role="status" className="text-body text-success">
            Thanks - your message is on its way.
          </p>
        )}
        {status.kind === "error" && (
          <p role="alert" className="text-body text-danger">
            {status.message}
          </p>
        )}
      </div>
    </form>
  );
}
