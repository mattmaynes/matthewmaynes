"use client";

import { useState } from "react";
import { usePostHog } from "posthog-js/react";
import { clientAnalyticsEnabled } from "@/lib/posthog-browser";
import { Button, FormField, FormFieldControl, FormFieldLabel, Input } from "@/components/ui";

/**
 * The blog subscribe box (spec 0018). A `"use client"` island (Canopy inputs cross
 * the client boundary via `@/components/ui`, per overview/learnings) that posts an
 * email to `POST /v1/subscribe` and reflects submitting / success / error state.
 * The Constant Contact credentials live only in server env behind that route -
 * nothing here knows them. A hidden honeypot field (`company`) catches naive bots.
 *
 * Layout is mobile-first: the input and button STACK full width by default and sit
 * inline on one row at `sm` and up (input flexes to fill, button hugs its label).
 */
type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

/** Shared focus-ring classes, matching the site's other interactive surfaces. */
const RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-ring-offset";

export function SubscribeForm({ className }: { className?: string }) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const posthog = usePostHog();

  // Track the conversion as explicit, PII-FREE events: the form is
  // `ph-no-capture`, so autocapture never sees the submit, and we send only the
  // outcome - never the email address. Gated so local runs stay off the live
  // dashboard (spec 0016), same as the contact form.
  const track = (event: string, properties?: Record<string, unknown>) => {
    if (clientAnalyticsEnabled()) posthog?.capture(event, properties);
  };

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setStatus({ kind: "submitting" });
    track("blog_subscribe_submitted");
    try {
      const res = await fetch("/v1/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          company: data.get("company"), // honeypot
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.ok) {
        form.reset();
        setStatus({ kind: "success" });
        track("blog_subscribe_succeeded");
      } else {
        setStatus({
          kind: "error",
          message:
            typeof json?.error === "string"
              ? json.error
              : "Something went wrong. Please try again.",
        });
        track("blog_subscribe_failed", { reason: `http_${res.status}` });
      }
    } catch {
      setStatus({
        kind: "error",
        message: "Could not reach the server. Please try again.",
      });
      track("blog_subscribe_failed", { reason: "network" });
    }
  }

  const submitting = status.kind === "submitting";

  return (
    <section className={className}>
      <h2 className="text-h3 font-bold text-text">Subscribe for updates</h2>
      <p className="mt-2 max-w-2xl text-body text-text-muted">
        New posts in your inbox now and then. No spam; unsubscribe anytime.
      </p>

      {/* `ph-no-capture` masks this subtree in session replay and keeps its input
          out of autocapture (spec 0014), so an email can never enter a recording. */}
      <form onSubmit={handleSubmit} className="ph-no-capture mt-5" noValidate>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <FormField className="w-full sm:flex-1">
            <FormFieldLabel className="sr-only">Email address</FormFieldLabel>
            <FormFieldControl>
              <Input
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                maxLength={200}
                className={RING}
              />
            </FormFieldControl>
          </FormField>

          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting ? "Subscribing..." : "Subscribe"}
          </Button>
        </div>

        {/* Honeypot: hidden from users and assistive tech; a naive bot that fills
            every input trips it and the server drops the request silently. */}
        <div className="hidden" aria-hidden>
          <label>
            Company
            <input type="text" name="company" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        {status.kind === "success" && (
          <p role="status" className="mt-3 text-body text-success">
            Thanks - you are on the list.
          </p>
        )}
        {status.kind === "error" && (
          <p role="alert" className="mt-3 text-body text-danger">
            {status.message}
          </p>
        )}
      </form>
    </section>
  );
}
