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
 * Layout is mobile-first: the fields STACK full width below `sm` and sit inline on
 * one row at `sm` and up. Revealing the optional Name field keeps the row inline at
 * `sm+` (email shortens, Name slides in between it and the button) rather than
 * reflowing the whole row to stacked - which used to jolt the button down and shift
 * the page on desktop (spec 0020).
 */
type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function SubscribeForm({
  className,
  source,
  alwaysShowName = false,
  heading = true,
}: {
  className?: string;
  /** Which surface this instance renders on - a PII-free analytics dimension so
   *  listing vs. post vs. the dedicated page are attributable. Never the email. */
  source: "blog_index" | "blog_post" | "subscribe_page";
  /** Show the optional Name field from first paint instead of on email focus -
   *  used by the dedicated `/subscribe` page, which leads with the full ask. */
  alwaysShowName?: boolean;
  /** Render the box's own heading + subtext. The dedicated `/subscribe` page
   *  supplies its own page-level copy, so it turns this off. */
  heading?: boolean;
}) {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Progressive disclosure (spec 0018 amendment): the optional Name field stays
  // hidden until the reader focuses the email, then stays revealed (never hidden
  // again, so it does not vanish out from under a click). The dedicated page
  // (`alwaysShowName`) starts revealed so all three fields show up front.
  const [expanded, setExpanded] = useState(alwaysShowName);
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
    // `has_name` is PII-free (a boolean, never the name itself) so we can see how
    // often the optional field is used without capturing what was typed.
    const nameVal = data.get("name");
    const hasName = typeof nameVal === "string" && nameVal.trim() !== "";
    track("blog_subscribe_submitted", { source, has_name: hasName });
    try {
      const res = await fetch("/v1/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: data.get("email"),
          name: data.get("name"), // optional; split into first/last server-side
          company: data.get("company"), // honeypot
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json?.ok) {
        form.reset();
        setStatus({ kind: "success" });
        track("blog_subscribe_succeeded", { source, has_name: hasName });
      } else {
        setStatus({
          kind: "error",
          message:
            typeof json?.error === "string"
              ? json.error
              : "Something went wrong. Please try again.",
        });
        track("blog_subscribe_failed", {
          reason: `http_${res.status}`,
          source,
          has_name: hasName,
        });
      }
    } catch {
      setStatus({
        kind: "error",
        message: "Could not reach the server. Please try again.",
      });
      track("blog_subscribe_failed", { reason: "network", source, has_name: hasName });
    }
  }

  const submitting = status.kind === "submitting";

  return (
    <section className={className}>
      {heading ? (
        <>
          <h2 className="text-h3 font-bold text-text">Subscribe for updates</h2>
          <p className="mt-2 max-w-2xl text-body text-text-muted">
            New posts in your inbox now and then. No spam; unsubscribe anytime.
          </p>
        </>
      ) : null}

      {/* `ph-no-capture` masks this subtree in session replay and keeps its input
          out of autocapture (spec 0014), so an email can never enter a recording. */}
      <form
        onSubmit={handleSubmit}
        className={`ph-no-capture ${heading ? "mt-5" : ""}`}
        noValidate
      >
        {/* The row stays inline at sm+ whether or not the optional Name field is
            revealed: email flexes wider (sm:flex-[2]) and shortens to make room, and
            the revealed Name sits between it and the button (sm:flex-1). Below sm the
            fields stack. DOM order (email -> Name -> button) is the visual order. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <FormField className="w-full sm:flex-[2]">
            <FormFieldLabel className="sr-only">Email address</FormFieldLabel>
            <FormFieldControl>
              <Input
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
                maxLength={200}
                onFocus={() => setExpanded(true)}
              />
            </FormFieldControl>
          </FormField>

          {/* Optional Name (spec 0018 amendment). Always in the DOM (so its label
              ships in the SSR HTML) but display:none until revealed, so it is not
              focusable or announced until the reader shows intent. When shown it
              takes `sm:flex-1` - a marker unique to the revealed state (spec 0020). */}
          <FormField className={expanded ? "w-full sm:flex-1" : "hidden"}>
            <FormFieldLabel className="sr-only">Name (optional)</FormFieldLabel>
            <FormFieldControl>
              <Input
                name="name"
                type="text"
                placeholder="Name (optional)"
                autoComplete="name"
                maxLength={100}
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
