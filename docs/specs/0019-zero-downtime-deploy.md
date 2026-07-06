# 0019 - Zero-downtime deploys (blue/green via docker-rollout)

## Problem

A deploy briefly takes the site down. The CD job already pre-pulls the new image
(`deploy.yml`: `docker compose ... pull` before `up -d --wait`), so the pull is not
the cause. The cause is structural: the site runs as a **single container with a fixed
name** (`compose.site.yml`: `container_name: site`, one replica) and Caddy routes to it
with `reverse_proxy site:3000`. On an image change, `docker compose up -d` **stops the
old `site` and starts the new one in its place** - it cannot run two containers with the
same name, so there is no overlap. During the gap (old stopped -> new boots, Next
standalone ~1-3s, plus the image HEALTHCHECK `--start-period=15s`) Caddy has no live
backend and returns 502s. `--wait` only makes the *deploy job* wait for health; it does
not keep the old container serving. So every deploy has a short hard-down window, which
is what was observed.

This matters because deploys happen on every push to `main` (several a day during active
work), and the site is the owner of the shared edge proxy that also fronts a cohosted
domain, so its availability posture is worth getting right.

## Outcome

A push to `main` deploys with **no user-visible downtime**: throughout the swap, requests
to `https://matthewmaynes.com` continue to return `200` (never a 502 / connection
refused). The new container is started **alongside** the old, becomes healthy, and only
then does the old one go away - and Caddy always routes to whichever container(s) are
currently live. A broken image still fails the deploy (the new container never goes
healthy, the old keeps serving), so a bad build cannot black-hole the site. Rollback
stays a one-line pinned-tag redeploy.

## Scope

In:
- Add the **`docker-rollout`** Docker CLI plugin to the host, pinned and checksum-verified
  (installed idempotently by the deploy, or a one-time bootstrap step it guards on).
- **`compose.site.yml`**: remove `container_name: site` (docker-rollout needs indexed
  names to run two instances). Keep `expose: 3000` (no host port is published, so there
  is no port conflict to remove), the `edge` network, env/env_file, and the image
  HEALTHCHECK. The service network alias stays `site` (the service name), which is what
  Caddy resolves.
- **`Caddyfile`** (matthewmaynes.com block only): replace the static `reverse_proxy
  site:3000` with **dynamic A upstreams** that re-resolve the `site` alias against
  Docker's embedded DNS (`127.0.0.11`) on a short refresh, plus load-balancing retries so
  an in-flight request during the swap retries a live container. The `www` redirect and
  the cohosted `rogueoak.com` blocks are unchanged.
- **`deploy.yml`**: replace `docker compose -f compose.site.yml up -d --wait` with a
  pre-pull (kept) followed by `docker rollout -f deploy/docker/compose.site.yml site`
  (with `IMAGE_TAG` exported), tuned so it waits for the new container's health before
  removing the old. Keep the existing Caddyfile validate/reload logic and the label-scoped
  image prune.
- A **one-time cutover** note + guard: the first deploy after this change still has a
  legacy `container_name: site` container; reconcile it once (a single normal recreate,
  or remove the old container) so subsequent deploys are pure rollouts. Documented and
  handled in the deploy script so it is not a manual surprise.
- **Verification**: a poll of the live URL run *during* a real deploy shows continuous
  `200`s (no 502 / refused). Captured as the acceptance evidence.
- Docs (step 6): fold the blue/green mechanism into `overview/architecture.md`
  (deploy/proxy section); capture any friction as a learning.

Out:
- Applying the same treatment to the cohosted **rogueoak.com** backend - that stack lives
  in its own repo; this spec only owns the matthewmaynes.com routing in the shared
  Caddyfile. (The dynamic-upstream pattern is reusable there later.)
- Multi-host / orchestrator migration (Swarm, k8s, Compose `deploy.replicas` in Swarm
  mode). Single host, one rolling instance-pair, is the whole scope.
- Running the site at a **steady** 2+ replicas for capacity. Traffic is low; the second
  instance exists only transiently during a rollout.
- Session-affinity / draining beyond what a stateless Next server needs (there is no
  server-side session state to drain; `--pre-stop-hook` is available if that ever changes).
- Changing the image, the app, or the healthcheck contract. The existing HEALTHCHECK is
  the readiness signal both docker-rollout and Caddy rely on.

## Approach

**Rollout tool - `docker-rollout` (pinned).** A ~single-file shell CLI plugin that
"scales the service to twice the current instances, waits for the new containers to be
healthy, then removes the old." Install to `~/.docker/cli-plugins/docker-rollout` (the
deploy user's plugin dir), `chmod +x`. Because it runs on the host as part of a deploy
that already has elevated Docker access, treat it like the SHA-pinned GitHub Actions
(learnings 0002, supply-chain): download from a **pinned tag/commit** raw URL and
**verify a recorded `sha256`** before making it executable; the install step is a no-op
if the pinned binary is already present. Invocation: `IMAGE_TAG=... docker rollout -f
deploy/docker/compose.site.yml site`, with `-t` (health wait) set comfortably above the
image's `start-period` (15s) + interval, e.g. `-t 90`, and a small `--wait-after-healthy`
so Caddy's DNS refresh picks up the new container before the old is removed.

**Compose - drop the fixed name, keep everything else.** Removing `container_name: site`
lets Compose run `site-site-1` and `site-site-2` concurrently during a rollout; both
share the `site` network alias on `edge`, so Docker's embedded DNS returns both IPs while
they coexist. `expose: 3000` stays (Caddy reaches them over the network; no published host
port means nothing to collide). Everything else (image+`IMAGE_TAG`, env, `env_file`
`.env.site`, healthcheck, `restart: unless-stopped`, label for the scoped prune) is
unchanged.

**Caddy - dynamic upstreams so routing follows the swap.** A static `reverse_proxy
site:3000` resolves the name once and caches the IP, so it would keep hitting the old
container after a rollout. Replace it with dynamic A-record upstreams that re-resolve the
alias frequently against Docker DNS, load-balancing across whatever is live, with retries
covering the brief window between the old container's removal and the next DNS refresh:

    matthewmaynes.com {
        encode zstd gzip
        header Strict-Transport-Security "max-age=31536000; includeSubDomains"
        reverse_proxy {
            dynamic a {
                name      site
                port      3000
                refresh   1s
                resolvers 127.0.0.11
                versions  ipv4
                dial_timeout 3s
            }
            lb_try_duration 5s
            lb_retries      2
            fail_duration   10s
            unhealthy_status 502 503 504
        }
    }

During a rollout both containers resolve, so Caddy balances across both (old still healthy
the whole time). When the old is removed, the next 1s refresh drops it; any request that
dials the just-gone IP in that sub-second gap is retried against the live one
(`lb_try_duration`/`lb_retries` + passive `fail_duration`). Dynamic upstreams are part of
standard Caddy (`caddy:2-alpine`), so no custom proxy image or plugin is needed. This edit
changes the Caddyfile hash, so the deploy's existing "Caddyfile changed -> validate,
reload, verify every site block reached the running config, restart as fallback" path
(learnings: a bind-mounted Caddyfile is not applied by `compose up`) runs on the cutover
deploy - which is exactly what applies the new routing.

**Deploy sequence (deploy.yml, remote block).** Unchanged up to and including the
Caddyfile handling and `docker compose ... pull` (keep the pre-pull - it moves the image
onto the host before the swap so the rollout's new container starts instantly). Then:
ensure the pinned `docker-rollout` plugin is present (verified install, idempotent), and
run `docker rollout -f deploy/docker/compose.site.yml site` in place of `up -d --wait`.
Then a **post-rollout end-to-end health gate** (review 0019): the container HEALTHCHECK
only proves the app answers on localhost inside the container, not that Caddy's
dynamic-upstream routing reaches it - a wrong resolver / alias / IP version would leave
the deploy green while every visitor gets a 502, and nothing else re-verifies the routing
per deploy. So after the rollout, `curl` the site through Caddy over loopback
(`--resolve matthewmaynes.com:443:127.0.0.1`, so it does not depend on DNS/hairpin) and
`exit 1` if it is not reachable, with a short retry budget. Keep the label-scoped
`docker image prune`. The run-level `concurrency: deploy-main` group already serializes
deploys, so two rollouts never overlap.

**One-time cutover (zero-downtime, via the same rollout).** The first deploy after this
lands still finds the legacy `container_name: site` container. Rather than a separate
`rm`+recreate path (which would be a ~15-25s hard-down window and would not be fail-safe -
review 0019), the plain `docker rollout` handles it: it adds an indexed instance alongside
the legacy container (`up --no-recreate --scale site=2`), waits for the new one's health,
then removes the legacy one - so the cutover is itself zero-downtime, and if the new
instance never goes healthy it fails cleanly with the legacy container still serving. No
special-cased branch, and it self-clears once the indexed instance exists. (The transition
is scratch-tested on the host before merge to confirm rollout handles the legacy-named
container cleanly.)

**Verification (infra - observe, do not unit-test).** Zero-downtime is a runtime property,
so the evidence is a real deploy watched from outside AND a per-deploy gate that reddens a
regression. (1) *Per-deploy gate*: the post-rollout `curl` above runs on every deploy, so a
future revert to a static upstream / broken routing fails the deploy that introduced it -
not just this one. (2) *One-time live proof for this change*: a **high-rate** probe (a tight
loop with no inter-request sleep, every response recorded, any non-200 or connection error
counted as a failure - a 200ms serial poll can straddle and miss the sub-second swap gap)
run across a real deploy shows zero failures, and `docker events` / a watch loop confirms
the two `site-*` instances coexist mid-rollout then collapse to one. (3) *Fail-safe*: the
pullable-but-unhealthy path (what `docker rollout` actually guards - a non-pullable tag
fails earlier at `pull`) is exercised once on a scratch Compose project to confirm rollout
tears the new instance down and leaves the old serving, converting the acceptance item from
asserted to verified. No repo test suite change: this is deploy-pipeline behavior with no
app-code seam, mirroring how the deploy is already "verified against the running container,
not the job status" (learnings 0002).

## Acceptance

- [ ] A poll of `https://matthewmaynes.com` run continuously *through* a real deploy
      returns only `200` (no 502 / connection refused) from before the deploy starts until
      after it completes.
- [ ] Mid-rollout, `docker ps` on the host shows two `site-*` containers running
      concurrently; after the rollout it collapses back to one, and `docker image prune`
      (label-scoped) leaves the cohosted stack's images untouched.
- [ ] `docker-rollout` is installed from a **pinned** source and **checksum-verified**
      before use; the install step is idempotent (no-op when already present).
- [ ] `compose.site.yml` no longer sets `container_name`; the service still has no
      published host port, still joins `edge`, and still reads `.env.site`.
- [ ] The Caddyfile `matthewmaynes.com` block uses dynamic A upstreams (`resolvers
      127.0.0.11`, short `refresh`) with connection-level retry (`lb_try_duration`/
      `lb_retries`) and no passive `fail_duration`/`unhealthy_status` (which would strand a
      single steady-state upstream); the `www` and `rogueoak.com` blocks are unchanged;
      `caddy validate` passes and the running config serves the site.
- [ ] The deploy has a **post-rollout end-to-end health gate**: after the rollout it
      `curl`s the site through Caddy (loopback `--resolve`, not just the container
      healthcheck) and fails the deploy on a non-200, so a broken routing/upstream config
      reddens the deploy instead of shipping a green 502.
- [ ] The **pullable-but-unhealthy** image path fails the deploy while the previously-running
      container keeps serving (verified once on a scratch project); a non-pullable tag fails
      earlier at `pull`. A bad build cannot take the site down.
- [ ] `IMAGE_TAG` pinning still identifies the running version and a rollback is a
      one-line redeploy of the prior `sha-<commit>` tag.
- [ ] The one-time cutover from the legacy `container_name: site` container is handled by
      the same `docker rollout` (indexed instance up + healthy before the legacy one is
      removed - zero-downtime, fail-safe), with no separate `rm`+recreate path.
- [ ] `architecture.md` documents the blue/green rollout + dynamic-upstream routing;
      lint/build of the repo remain clean (no app code changed).
