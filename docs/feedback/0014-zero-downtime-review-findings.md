# 0014 - Zero-downtime deploy review findings (spec 0019)

## Symptom

The first cut of the blue/green rollout (PR #66) verified the new container only by its
**internal HEALTHCHECK** (a request to `localhost:3000` inside the container). That proves
the app answers, but not that Caddy's new **dynamic-upstream routing** actually reaches it.
A wrong resolver, a mistyped alias, or the wrong IP-version filter would leave every
container healthy and the deploy green while every visitor gets a 502 - and nothing in the
pipeline re-verified the routing per deploy, so the load-bearing Caddy block was silently
revertible. Separately, the first-cut one-time cutover (`docker rm -f site` then
`up -d --wait`) reintroduced the exact 15-25s hard-down window the spec exists to remove,
and was not fail-safe (it removed the only serving container before its replacement was
healthy).

## Root cause

Two altitude mismatches. (1) The readiness signal was scoped to the container, but the
property under test (no user-visible downtime) lives at the **edge**, one hop up - through
TLS, Caddy, and the dynamic upstream. Testing the inner hop cannot catch a broken outer
hop. (2) The cutover was written as a distinct code path ("special-case the legacy
container") when the general tool (`docker rollout`, which adds an indexed instance
alongside the old and only removes the old once the new is healthy) already handles it
zero-downtime and fail-safe - the special path was both more code and strictly worse.

## Fix

- **Post-rollout end-to-end health gate** in `deploy.yml`: after the rollout, `curl` the
  site through Caddy over loopback (`--resolve matthewmaynes.com:443:127.0.0.1`, so it does
  not depend on DNS/hairpin) and `exit 1` on a non-200, with a short retry budget. Now a
  broken routing/upstream config fails the deploy that caused it, and a future revert to a
  static upstream reddens rather than silently restoring downtime.
- **Drop the special cutover branch**: always `docker rollout`. It performs the
  legacy->indexed transition zero-downtime (new up + healthy before the old is removed) and
  fails cleanly (old keeps serving) if the new never goes healthy. Scratch-tested on the
  host before merge.
- **Caddy tuning**: dropped `unhealthy_status`/`fail_duration` - with a single steady-state
  upstream they would strand it on one 5xx/blip with nowhere to fail over; the swap gap is a
  dial failure, already covered by `lb_try_duration`/`lb_retries`.
- Hardened the plugin `curl` (`--proto '=https' --tlsv1.2 --max-time`) and added a
  `trap 'rm -f "$tmp"' EXIT` so a failed install leaks nothing.

## Learning

For a deploy whose goal is a *user-facing* property (availability, latency, correct
routing), the deploy must verify that property **at the edge the user hits**, not only at
the component it changed - an inner healthcheck passing is not the same as the outer path
working, and the two can disagree exactly when it matters. And a per-deploy gate, not a
one-time manual check, is what keeps a load-bearing-but-silently-revertible config
(here the Caddy upstream block) from regressing on a future change. Rolled into
`overview/learnings.md`.
