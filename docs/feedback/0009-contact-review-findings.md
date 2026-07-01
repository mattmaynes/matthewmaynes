# 0009 - Contact form review: PII in the spec, spoofable rate key, weak tests

Feedback from the persona review of PR #35 (spec 0008). One blocker, three majors,
plus minors folded into the same fix commit.

## Symptom

- **Blocker (security):** the private destination Gmail address was written verbatim
  into the tracked spec `docs/specs/0008-contact-form-email.md` (twice) and pushed to
  the public branch - the exact PII leak the whole feature exists to prevent. The
  runtime code was clean; the doc undid it.
- **Major (security):** the rate limiter keyed on the *first* `X-Forwarded-For`
  entry. Our Caddy proxy appends the real client IP as the *last* entry, so a bot
  could send a forged `X-Forwarded-For` prefix and rotate it to bypass the 5/10min
  cap entirely.
- **Major (tester):** the `/contact` smoke assertion checked "Find me elsewhere" -
  the social-row heading - so a dropped or broken `<ContactForm/>` would still pass.
- **Major (tester):** the named acceptance criterion "a burst returns 429" had no
  test; only the pure limiter was unit-tested, not the route's IP parsing + mapping.

## Root cause

- Writing the spec, I reached for the concrete value ("destination is X") for
  clarity, forgetting the spec is a tracked file in a public repo - the same rule
  the spec's own Problem section states. Prose is code for this purpose.
- The XFF parse assumed "client is first", which is true only *without* a trusted
  proxy in front; ours prepends nothing and appends, inverting the position. I did
  not check the Caddyfile's actual forwarding behavior before choosing the index.
- The smoke assertions anchored on the first route-unique string I saw (a heading),
  not on the *unit under test* (the form) - a recurrence of learnings 0001/0003.
- The happy path "sends" and the 429 path were both deferred as "needs creds",
  when the 429/500/guard paths are all reachable without ever sending.

## Fix

- Scrubbed both spec occurrences; **rewrote branch history** (amend + force-push) so
  no pushed commit on the branch contains the address, and re-grepped the tree clean.
- Rate key now takes the **last** `X-Forwarded-For` entry (the Caddy-appended real
  IP); documented the proxy assumption in-code.
- Smoke now asserts **form-unique** copy (the textarea placeholder) alongside the
  social heading, plus a **429** test, a **config-500 (no leak)** test, and a
  **/contact privacy** guard (flags any email but the example placeholder). The test
  server is spawned with the contact creds forced empty, so these valid POSTs always
  fail closed and never send real mail.
- Minors folded in: bounded the limiter Map (opportunistic sweep), added an
  `AbortSignal.timeout` to the Resend fetch, a `Content-Length` pre-parse cap (413),
  subject control-char stripping, and stronger send/boundary test assertions.

## Learning

Rolled into `overview/learnings.md`. In short: (1) a spec/plan is a tracked public
artifact - never put a real secret/PII in one, not even as an illustration; (2)
derive the client IP from the *proxy's actual* XFF behavior, not the generic
"first entry" rule; (3) assert the unit under test, and remember guard/error paths
are testable without the happy-path dependency.
