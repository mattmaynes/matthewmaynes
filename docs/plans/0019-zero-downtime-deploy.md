# Plan 0019 - Zero-downtime deploys (blue/green via docker-rollout)

Source spec: `docs/specs/0019-zero-downtime-deploy.md`. Files touched, exact changes,
verification. No app code changes - only deploy pipeline, compose, proxy config, docs.

Pinned tool: `docker-rollout` v0.13, commit `39b8066d56cc1edc76d1ae898db46623cc93bc24`,
sha256 `fa0df004de84747142cb627c55210aaa914bbae76666e7b95a2ac46805d81a84`.

## Step 1 - compose.site.yml: drop the fixed container name

- Remove `container_name: site` so Compose can run two indexed instances
  (`site-site-1` / `site-site-2`) during a rollout. Keep `name: site` (project),
  `expose: 3000`, `edge` network, env, `env_file: .env.site`, `restart`, and the label.
- Add a short comment: no `container_name` on purpose (docker-rollout needs indexed
  names); the service network alias stays `site`, which Caddy resolves.

## Step 2 - Caddyfile: dynamic A upstreams for the site block

- Replace `reverse_proxy site:3000` in the `matthewmaynes.com` block with a dynamic
  A-record upstream re-resolving the `site` alias against Docker DNS, plus retry/passive
  health so an in-flight request during the swap retries a live container:

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

- Leave `encode`, the HSTS header, the `www.matthewmaynes.com` redirect, and BOTH
  `rogueoak.com` blocks unchanged (rogueoak is a separate repo / follow-up).

## Step 3 - deploy.yml: install rollout, swap in the rollout, one-time cutover

In the remote SSH heredoc, after the existing Caddyfile handling and the
`compose ... pull` (keep the pre-pull), before the prune:

1. **Install docker-rollout (idempotent, pinned + checksum-verified):**
   - `plugin="$HOME/.docker/cli-plugins/docker-rollout"`.
   - If `echo "$ROLLOUT_SHA256  $plugin" | sha256sum -c -` fails (missing or wrong),
     `curl -fsSL` the pinned-SHA raw URL to a tempfile, verify its sha256, `chmod +x`,
     `mv` into place. No-op when already correct.
2. **Deploy the new version:**
   - Legacy cutover guard (runs at most once): if a container literally named `site`
     exists (from the old `container_name`), remove it and do one final
     `docker compose ... up -d --wait` to establish Compose-indexed naming (accepts one
     last brief blip); ELSE run
     `docker rollout -t 90 --wait-after-healthy 5 -f deploy/docker/compose.site.yml site`.
   - `IMAGE_TAG` stays exported so both `pull` and the new container resolve the pinned tag.
3. Keep the label-scoped `docker image prune`.

Record the pin as shell vars at the top of the heredoc with a comment pointing at the
release, mirroring the SHA-pinned Actions rationale (learnings 0002, supply chain).

## Step 4 - architecture.md: document the rollout

- In the deploy/proxy section, describe the blue/green rollout (docker-rollout scales to
  2, waits for health, removes old) and the dynamic-upstream routing (Caddy re-resolves
  the `site` alias so it follows the swap), and why the pre-pull is kept.

## Step 5 - Verify (no app-code seam; validate config locally, prove live on deploy)

Local (worktree), before commit:
1. `caddy validate` the new Caddyfile via the pinned image:
   `docker run --rm -v "$PWD/deploy/docker/Caddyfile:/etc/caddy/Caddyfile:ro"
   caddy:2-alpine caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile`.
2. `docker compose -f deploy/docker/compose.site.yml config` parses with no
   `container_name`.
3. Lint/build of the repo remain clean (no app code changed) - CI `verify` covers it.

Live (after merge, on the host):
4. Watch a real deploy: poll `https://matthewmaynes.com` every ~200ms across the deploy;
   expect only `200` (no 502 / connection refused). Confirm two `site-*` containers
   coexist mid-rollout (`docker ps`) then collapse to one.
5. Confirm a broken image would fail the rollout while the old container keeps serving
   (reason through / spot-check; do not intentionally ship a broken image to prod).

## Step 6 - PR + review + merge

- Commit, push, PR against `main`.
- Personas by facet: **architect** (deploy/proxy topology, dynamic upstreams, cutover),
  **security** (third-party plugin on the host - pinning + checksum, elevated deploy),
  **engineer** (the deploy shell logic, idempotent install, cutover guard),
  **tester** (verification strategy for an infra change with no unit seam). Designer /
  analytics not in scope (no UI, no events).
- Address majors/blockers (feedback + learning), re-run CI, merge on approval.

## Step 7 - Reflect + drive the real deploy

- After merge, watch the deploy (Step 5) and fix any issue before calling it done.
- Update `overview/learnings.md` with any friction (e.g. Caddy DNS caching, cutover).

## Step 8 (separate, after this merges) - replicate to ../rogueoak

Tracked here for continuity; executed as its own change in the rogueoak repo + a
follow-up Caddyfile edit in THIS repo:
- rogueoak repo: drop `container_name` from its site compose; add the pinned
  docker-rollout install + `docker rollout` to its deploy workflow.
- this repo's Caddyfile: give the `rogueoak.com` block the same dynamic-A-upstream
  treatment (alias `rogueoak`). That is a second, small matthewmaynes PR.
