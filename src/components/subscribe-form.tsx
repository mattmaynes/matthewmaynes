"use client";

import { usePostHog } from "posthog-js/react";
import { clientAnalyticsEnabled } from "@/lib/posthog-browser";
import {
  SubscribeForm as CanopySubscribeForm,
  type SubscribeEventPhase,
  type SubscribeValues,
} from "@/components/ui";

/**
 * The blog subscribe box (spec 0018). A thin app wrapper around Canopy's
 * `SubscribeForm` Branch (`@rogueoak/canopy/branches`, spec 0035), which owns the
 * layout, the submit/success/error state machine, the optional-Name reveal, the
 * honeypot, and the a11y wiring. This wrapper injects only the app-specific parts:
 * the transport (`onSubscribe` posts to `POST /v1/subscribe`), the analytics
 * (`onEvent` -> PostHog, PII-free), and the copy.
 *
 * The Constant Contact credentials live only in server env behind that route -
 * nothing here knows them. `onSubscribe` forwards the honeypot (`company`) value so
 * the server can still drop naive bots.
 */
/**
 * Which surface a subscribe form instance renders on - a PII-free analytics
 * dimension so the placements are separately attributable. Never the email.
 *
 * Exported so a caller can name the type instead of restating the union.
 * `blog_post_inline` is the mid-article `<PostSubscribe />` block (spec 0041),
 * deliberately distinct from `blog_post` (the end-of-post block) so the two
 * placements that can appear on the SAME page stay separable.
 */
export type SubscribeSource =
  | "blog_index"
  | "blog_post"
  | "blog_post_inline"
  | "blog_tag"
  | "blog_category"
  | "subscribe_page"
  | "links_page";

/**
 * The reassurance line, shared so every placement makes the same promise. The
 * mid-article block (spec 0041) restates it above its own form, so a change here
 * must not leave the two surfaces saying different things.
 */
export const SUBSCRIBE_NO_SPAM = "No spam; unsubscribe anytime.";

export function SubscribeForm({
  className,
  source,
  alwaysShowName = false,
  heading = true,
}: {
  className?: string;
  source: SubscribeSource;
  /** Show the optional Name field from first paint instead of on email focus -
   *  used by the dedicated `/subscribe` page, which leads with the full ask. */
  alwaysShowName?: boolean;
  /** Render the box's own heading + subtext. The dedicated `/subscribe` page
   *  supplies its own page-level copy, so it turns this off. */
  heading?: boolean;
}) {
  const posthog = usePostHog();

  // Map Canopy's generic phases to this app's explicit event names, PII-free and
  // gated so local runs stay off the live dashboard (spec 0016), same as the contact
  // form. The names are full literals (not `blog_subscribe_${phase}`) so each ships
  // verbatim in a client chunk - the smoke test asserts the submit event is present.
  const EVENTS: Record<SubscribeEventPhase, string> = {
    submitted: "blog_subscribe_submitted",
    succeeded: "blog_subscribe_succeeded",
    failed: "blog_subscribe_failed",
  };
  function onEvent(
    phase: SubscribeEventPhase,
    props: { source: string; has_name: boolean; reason?: string },
  ) {
    if (clientAnalyticsEnabled()) posthog?.capture(EVENTS[phase], props);
  }

  // Perform the subscription. Posts the collected values (including the honeypot)
  // to the server route, which holds the Constant Contact secrets. Rejects with the
  // user-facing message and a machine `reason` (surfaced to `onEvent('failed')`).
  async function onSubscribe({ email, name, company }: SubscribeValues) {
    let res: Response;
    try {
      res = await fetch("/v1/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, company }),
      });
    } catch {
      throw Object.assign(new Error("Could not reach the server. Please try again."), {
        reason: "network",
      });
    }
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.ok) return;
    throw Object.assign(
      new Error(
        typeof json?.error === "string" ? json.error : "Something went wrong. Please try again.",
      ),
      { reason: `http_${res.status}` },
    );
  }

  return (
    <CanopySubscribeForm
      // ph-no-capture keeps the typed address out of PostHog autocapture and
      // session replay. Spec 0018 requires it and the contact form still has it,
      // but the Canopy migration dropped it here - `maskAllInputs` was masking the
      // value anyway, so nothing leaked and nothing failed. Restored at the wrapper
      // so all seven placements get it, including the new in-article one this spec
      // puts in the middle of a post. Callers' own classes are preserved.
      className={["ph-no-capture", className].filter(Boolean).join(" ")}
      source={source}
      alwaysShowName={alwaysShowName}
      heading={heading}
      onSubscribe={onSubscribe}
      onEvent={onEvent}
      title="Subscribe for updates"
      description={`New posts in your inbox now and then. ${SUBSCRIBE_NO_SPAM}`}
      successBadge="You are on the list"
      successMessage="Check your inbox for a welcome message. If you do not see it, look in your junk or spam folder, move it to your inbox, and mark it as not spam. That keeps my emails landing in your inbox, and it helps me reach everyone else too. Thank you!"
    />
  );
}
