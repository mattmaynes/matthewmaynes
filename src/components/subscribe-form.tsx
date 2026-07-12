"use client";

import { useState } from "react";
import { Check } from "@rogueoak/icons";
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
  source: "blog_index" | "blog_post" | "blog_tag" | "subscribe_page";
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
        {/* On a successful subscribe (spec 0025), the fields + button are replaced in
            place by a badge-shaped confirmation, now followed by a short note that
            points the reader to the welcome email and asks them to rescue it from
            spam - deliverability improves for everyone when readers mark it as wanted.
            Otherwise the input row renders: it stays inline at sm+ whether or not the
            optional Name field is revealed (email sm:flex-[2] shortens; the revealed
            Name sits between it and the button); below sm the fields stack. */}
        {status.kind === "success" ? (
          <div role="status" className="subscribe-badge-enter flex flex-col gap-3">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-2 text-body font-medium text-success">
              <Check aria-hidden className="h-4 w-4" />
              You are on the list
            </span>
            <p className="max-w-2xl text-body text-text-muted">
              Check your inbox for a welcome message. If you do not see it, look in your
              junk or spam folder, move it to your inbox, and mark it as not spam. That
              keeps my emails landing in your inbox, and it helps me reach everyone else
              too. Thank you.
            </p>
          </div>
        ) : (
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
              ships in the SSR HTML). Instead of display:none (which cannot animate),
              it collapses via size + opacity and ANIMATES open on reveal (spec 0024):
              on sm+ it grows horizontally (max-w 0 -> md, the button slides over); below
              sm it grows vertically (max-h 0 -> 24, the button is pushed down). Fast +
              eased; `motion-reduce:transition-none` makes it instant for reduced-motion
              users. `sm:max-w-md` is only an animation cap - wider than the field's real
              flex width in every container, so it never clips. While collapsed the input
              is out of the tab order + a11y tree, restored on reveal. */}
          <FormField
            className={`w-full overflow-hidden transition-all duration-200 ease-out motion-reduce:transition-none sm:flex-1 ${
              expanded
                ? "max-h-24 opacity-100 sm:max-h-none sm:max-w-md"
                : "pointer-events-none max-h-0 opacity-0 sm:max-h-none sm:max-w-0"
            }`}
          >
            <FormFieldLabel className="sr-only">Name (optional)</FormFieldLabel>
            <FormFieldControl>
              <Input
                name="name"
                type="text"
                placeholder="Name (optional)"
                autoComplete="name"
                maxLength={100}
                aria-hidden={expanded ? undefined : true}
                tabIndex={expanded ? undefined : -1}
              />
            </FormFieldControl>
          </FormField>

          <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
            {submitting ? "Subscribing..." : "Subscribe"}
          </Button>
          </div>
        )}

        {/* Honeypot: hidden from users and assistive tech; a naive bot that fills
            every input trips it and the server drops the request silently. */}
        <div className="hidden" aria-hidden>
          <label>
            Company
            <input type="text" name="company" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        {status.kind === "error" && (
          <p role="alert" className="mt-3 text-body text-danger">
            {status.message}
          </p>
        )}
      </form>
    </section>
  );
}
