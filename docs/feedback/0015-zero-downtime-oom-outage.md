# 0015 - Zero-downtime rollout OOM'd the small VM (spec 0019)

## Symptom

The first real deploy after the blue/green rollout landed (spec 0019, on the
`subscribe-name` merge) took the site **down** and wedged the host. Observed: the
"Deploy over SSH" step hung for ~11 minutes (no `timeout-minutes` on that job); the site
returned nothing (port 443 accepted the TCP/TLS connection - Caddy was up - but HTTPS
requests timed out, because Caddy had no healthy `site` upstream); and the host's `sshd`
stopped answering (`Connection timed out during banner exchange`), so it could not be
reached to recover. Canceling the workflow freed the runner but not the host; the box had
to be **rebooted from the provider console**.

## Root cause

Memory exhaustion on an undersized VM. `docker rollout` deliberately runs **two `site`
instances** during the swap (the ~2x-memory overlap the architect flagged in review 0019).
On the ~512MB droplet - which also runs Caddy **and** the cohosted rogueoak Next app, plus
a fresh image was being pulled/unpacked - two Next standalone servers pushed total usage
past RAM. There was **no swap**, so the kernel OOM-killer/thrash took over: it starved
`sshd` (hence the banner-exchange timeout) and left Caddy with no live backend. The rollout
process, mid-swap, could not finish, so the deploy step hung. On reboot the leftover state
was telling: `site-site-3` (new image) **and** `site-site-2` (old image) were both running
- the rollout had created the new instance but never removed the old, so at the moment of
failure there were two heavyweight instances live at once, exactly the overlap that
overflowed. (The cutover from the legacy `container_name: site` container itself worked -
no container named `site` remained - so the fault was capacity, not the cutover logic.)

## Fix

- **Capacity**: the VM RAM was doubled (to ~1GB) so a 1->2 rollout overlap plus the
  cohosted neighbours fits with margin.
- **Swap**: add a 2GB swap file on the host (there was none) as OOM insurance for the
  transient pull+overlap spike (`vm.swappiness=10`). Host-level, root-owned; recorded in
  the private operator runbook.
- **Per-service memory cap**: `compose.site.yml` now sets `mem_limit: 400m` /
  `mem_reservation: 192m` on the site service - well above its real ~120MB SSR footprint,
  so it never trips in normal use, but it caps a runaway/leak so one stack can no longer
  OOM the whole box and take down the cohosted neighbour. (rogueoak's stack should get the
  same, in its repo.)
- **Recovery** performed live: converged the split old/new instances back to the single new
  one (`docker rm -f site-site-2`), cleaned up unrelated scratch-test leftovers, and
  confirmed Caddy was serving the new dynamic-upstream config end-to-end.

## Learning

**A zero-downtime rollout that overlaps N->2N instances needs the host verified to hold
the peak, including cohosted neighbours - "zero-downtime" doubles the memory footprint for
the duration of the swap, so on a small/shared box it can *cause* the outage it was meant
to prevent.** Size for the overlap (RAM + swap), cap each service so one tenant can't starve
the box (`mem_limit`), and give the deploy step a `timeout-minutes` so a wedged swap fails
fast instead of hanging for 11 minutes. Also: a deploy that changes the *runtime topology*
(container count/memory) is a capacity change, not just a config change - check the target's
headroom before shipping it. Rolled into `overview/learnings.md`.
