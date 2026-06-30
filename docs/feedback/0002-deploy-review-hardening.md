# 0002 - Deploy review hardening

Source: persona review of PR #2 (spec `0002`). Three **major** findings, all in the first cut of
the CD/deploy workflow. Captured here so the lessons outlive the PR.

## Symptom

The initial `.github/workflows/deploy.yml` + `deploy/docker/` stacks worked end to end but carried
three latent failure modes the personas caught:

1. **Broken images shipped green.** `docker compose up -d` returns 0 once the container is
   *created*; with `restart: unless-stopped` a crash-looping image flaps while the deploy reports
   success. (engineer)
2. **Unauthenticated droplet.** The deploy ran `ssh-keyscan >> known_hosts` every run
   (trust-on-first-use), so a MITM during any deploy could impersonate the host - high blast radius
   because the deploy user is docker-group/root-equivalent. (security)
3. **Mutable-tag supply chain.** All Actions were pinned to moving major tags (`@v4`, `@v3`, ...).
   A hijacked tag runs with `packages: write` and can push a poisoned image the droplet then runs
   as root. (security)

## Root cause

Treated "the commands run and the site loads" as done, without modelling the *failure* paths:
partial/unhealthy rollout, an active network attacker, and a compromised upstream dependency. The
happy path is the easy 80%.

## Fix

1. `docker compose up -d --wait` (the image already has a HEALTHCHECK), so a bad image is a red
   deploy.
2. Pin the host key via a `DROPLET_KNOWN_HOSTS` secret; drop `ssh-keyscan`. Generated once with the
   fingerprint confirmed against the DO console.
3. Pin every Action to a full commit SHA (tag in a trailing comment) and add `dependabot.yml` to
   bump them. Also moved `packages: write` from workflow-wide to the `build` job only.

Plus the lower-severity fixes in the same pass: project `name:` on each stack, label-scoped image
prune, `git fetch`+`reset --hard` (drift-proof), `IMAGE_TAG`-pinned deploys for auditable rollback,
HSTS at the edge, `ufw` 443/udp, `caddy reload` for cohosting, ssh `BatchMode`/`ConnectTimeout`.

## Learning

For any CD/SSH deploy: gate on container **health** not creation, **authenticate** the target host
(pin keys, never keyscan-on-the-fly), and **pin dependencies** (Action SHAs) with least-privilege
tokens. Rolled into `overview/learnings.md`.
