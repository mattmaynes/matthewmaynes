# 0032 - Contact form: on-brand HTML notification + Constant Contact CRM/subscribe

## Problem

The contact form (`/v1/contact`, spec 0008) does two things poorly for a form that is the
site's main "get in touch" path:

1. The notification it emails to the owner is **plain text** (`From: ... \n\n message`). It
   works, but it is bare next to the on-brand HTML the blog announcements send.
2. Every submission is **fire-and-forget** - the message lands in an inbox and nothing
   records *who* reached out. There is no lightweight CRM trail of website leads, and no way
   for a sender to opt into the mailing list at the moment they are already typing their
   email. The blog already has a Constant Contact (CTCT) list + subscribe flow (spec 0018);
   the contact form is disconnected from it.

We want the contact form to (a) send a good-looking HTML notification, and (b) always record
the sender in CTCT - as a CRM contact by default, and as a mailing-list subscriber when they
opt in.

For: the site owner (a real inbox notification + a CRM trail of who has reached out) and the
visitor (a one-click way to also subscribe while contacting).

## Outcome

Observable when done:

1. A contact submission emails an **on-brand HTML notification** (Harbor header, sender name,
   `mailto:` email, the message with line breaks preserved, a Reply button), rendered from
   `emails/templates/contact-notification.html` with the form fields **HTML-escaped** and
   injected server-side. Delivery stays on **Resend** (transactional/instant); a plaintext
   part is kept as a fallback.
2. **Every** submission records the sender in Constant Contact as an **`unsubscribed`**
   contact on the **"Website Contact"** list - a CRM record that implies no marketing consent.
3. A **"Subscribe for updates from me"** checkbox sits under the Email field, **unchecked by
   default**. When ticked, the sender is instead added via `sign_up_form` (opt-in) to **both**
   the "Matthew Maynes Blog" list and the "Website Contact" list - identical to the standalone
   subscribe form, plus the CRM list.
4. The CTCT step is **best-effort**: the message send is primary, so a CTCT failure is logged
   and swallowed (still `{ ok: true }`) rather than losing the visitor's message. With the
   CTCT env unset, the step is skipped cleanly.

## Approach

- **No transactional send via CTCT.** CTCT has no transactional API (a send is a campaign),
  which would add latency and clutter the account with a campaign per submission. So the
  notification stays on Resend; CTCT is used only for the contact record + subscribe. A
  welcome side effect: **only contact scope is needed**, no campaign OAuth scope.
- **Two CTCT endpoints, chosen by consent:**
  - Opt-in -> `POST /contacts/sign_up_form` (additive, records consent) with
    `list_memberships: [blog, website]`. Reuses `submitSubscription` (spec 0018), generalized
    to accept multiple list ids.
  - Default -> `POST /contacts` (`createContact`) with
    `email_address.permission_to_send: "unsubscribed"` and `list_memberships: [website]`. A new
    `addUnsubscribedContact` / `recordWebsiteContact` pair mirrors the subscribe path (same
    token cache + 401 self-heal). `sign_up_form` cannot be used here - it always implies opt-in.
- **Template bundling.** The template lives in `emails/templates/` (single source of truth,
  previewable). `next.config.ts` `outputFileTracingIncludes` copies it into the standalone
  output so the Dockerized runtime can `readFileSync` it via `process.cwd()`.
- **Escaping.** The body is now HTML, so `renderContactNotification` HTML-escapes every field
  before substituting the `[[NAME]]/[[EMAIL]]/[[MESSAGE]]/[[DATE]]` tokens (message newlines ->
  `<br>`). A crafted name/message can never inject markup into the email.

## Out

- **Guaranteed Website Contact membership for pre-existing contacts on the default path.** If a
  sender already exists in CTCT, `POST /contacts` 409s and we leave them untouched (no forced
  list add), to avoid downgrading an existing subscriber's consent or clobbering their lists.
  New senders (the common case) are recorded exactly as specified. A consent-safe list-add
  (email lookup -> `add_list_memberships` activity) for existing contacts is a possible
  follow-on.
- **A confirmation UI for the opt-in.** The checkbox result is not surfaced separately in the
  success state; the existing "Thanks - your message is on its way." covers both.
- **Editing/leaving the mailing list from the site.** Unsubscribe is handled by CTCT's
  footer in any email sent, as before.
