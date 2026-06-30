# 0002 - Droplet deploy (matthewmaynes.com)

## Problem

The walking skeleton (spec `0001`) runs only locally via `docker compose`. To put a first
version online, the containerized site needs a public home at `https://matthewmaynes.com` with
managed HTTPS. The droplet is also intended to **cohost** future sites/containers, so the setup
must route by hostname from day one rather than bind a single app to ports 80/443.

Audience: the site's visitors (employers, collaborators, engineers) reaching a live URL; and the
operator (Matthew) who needs a repeatable deploy.

## Outcome

- Visiting `https://matthewmaynes.com` serves the live site over HTTPS with a valid, auto-renewing
  certificate.
- `https://www.matthewmaynes.com` and any `http://` request redirect to the canonical
  `https://matthewmaynes.com`.
- The droplet runs two stacks on a shared `edge` network: a **Caddy** reverse proxy (owns 80/443)
  and the **site** container (internal only). Adding a second site later = one more service on
  `edge` + a few lines of Caddyfile, no change to the site stack.
- Deploy artifacts live under `deploy/docker/` so a future `deploy/helm/` or `deploy/terraform/`
  can sit beside them without churn.
- The production image is pulled from **GHCR** (`ghcr.io/mattmaynes/matthewmaynes`), built
  off-host so the 512MB droplet never runs a memory-hungry Next build.
- **Pushing to `main` ships it.** A GitHub Actions pipeline builds the image, pushes it to GHCR,
  and triggers the droplet to pull and restart - no manual step in the normal path.
- A deploy runbook documents provisioning, DNS, the pipeline, and the manual bootstrap/fallback.

## Scope

**In:**
- `deploy/docker/` directory: reverse-proxy compose (`compose.proxy.yml`), production site compose
  (`compose.site.yml`), and `Caddyfile`. (`deploy/docker/` leaves room for `deploy/helm/` etc.)
- Keep the root `docker-compose.yml` as the **local** dev/build compose (builds from source,
  publishes `3000:3000`); production never uses it.
- **GitHub Actions CD pipeline** (`.github/workflows/deploy.yml`): on push to `main`, build
  `linux/amd64`, push to GHCR, then SSH to the droplet to pull + restart the site stack.
- Manual build/push + droplet pull documented as the **bootstrap/fallback** path (first image
  before the droplet exists; recovery if the pipeline is down).
- Namecheap DNS records for apex + `www`.
- Droplet provisioning runbook (`deploy/docker/README.md`): create droplet, swap, install Docker,
  create `edge` network, firewall, deploy SSH key, bring up proxy + site, first-deploy + update.
- Make the GHCR package **public** so the droplet pulls without registry auth.

**Out (later specs/enhancements):**
- Contact-form SMTP secrets and spam protection (contact form itself is a later feature).
- Monitoring/alerting, log shipping, automated backups, staging environment.
- CDN / image optimization tuning beyond Next defaults.

## Approach

**Topology.** One external Docker network `edge`. Caddy is the only thing publishing host ports
(80/443); it terminates TLS and reverse-proxies to backends by hostname over `edge`. The site
container exposes 3000 only on `edge` (no host binding), so cohosted apps never collide on ports.

```
internet -> :80/:443 Caddy (deploy/docker/) --edge--> site:3000 (standalone Next server)
                                              --edge--> (future) other-site:PORT
```

**Reverse proxy (`deploy/docker/compose.proxy.yml` + `Caddyfile`).**
- `compose.proxy.yml`: `caddy:2-alpine`, publishes `80:80` + `443:443`, joins external `edge`,
  named volumes for `/data` (certs/ACME state) and `/config`, mounts `./Caddyfile` read-only,
  `restart: unless-stopped`.
- `Caddyfile`: `matthewmaynes.com` block → `reverse_proxy site:3000`, with `encode zstd gzip`.
  A `www.matthewmaynes.com` block issues a `redir` to the apex. Caddy auto-provisions and renews
  Let's Encrypt certs (needs DNS pointing at the droplet first). HTTP->HTTPS is automatic.

**Production site stack (`deploy/docker/compose.site.yml`).**
- `image: ghcr.io/mattmaynes/matthewmaynes:latest` (built/pushed off-host; no `build:` on the
  droplet).
- `expose: ["3000"]` only - no host port publish; join `edge` (external).
- `environment`: `NODE_ENV=production`, `SITE_URL=https://matthewmaynes.com`. (Non-secret; SMTP
  comes with the contact-form spec.)
- Container name/alias `site` so Caddy resolves it via Docker DNS on `edge`; keep
  `restart: unless-stopped` + the image's healthcheck.
- Local dev is unaffected: `npm run dev`, or the root `docker-compose.yml` for a full-stack
  build/smoke on `localhost:3000`.

**CI/CD (GitHub Actions, `.github/workflows/deploy.yml`).**
- Trigger: `push` to `main` (plus `workflow_dispatch` for manual re-runs).
- **Build + push job** on `ubuntu-latest` (native amd64 - no QEMU): `docker/build-push-action`
  with buildx. Auth to GHCR via the built-in `GITHUB_TOKEN` (`permissions: packages: write`) - no
  PAT needed for push. Tags: `latest` + the commit `sha` (immutable, lets us roll back/pin).
- **Deploy job** (after build): SSH to the droplet and, in the cloned repo, run `git pull` then
  `docker compose -f deploy/docker/compose.site.yml pull && ... up -d`. Uses repo secrets
  `DROPLET_HOST`, `DROPLET_USER`, `DROPLET_SSH_KEY` (a dedicated deploy key, not a personal key).
  The droplet pulls the **public** GHCR image, so it needs no registry login.
- Gate quality before shipping: the build job runs `npm ci` + lint + `npm test` (or depends on the
  existing CI), so a red build never deploys.

**Manual bootstrap / fallback.**
- First image, before the droplet or pipeline exists - or recovery if Actions is down:
  `docker buildx build --platform linux/amd64 -t ghcr.io/mattmaynes/matthewmaynes:latest --push .`
  (authenticate once with a GHCR PAT carrying `write:packages`), then on the droplet
  `docker compose -f deploy/docker/compose.site.yml pull && ... up -d`.

**Secrets & ordering.**
- GHCR push uses `GITHUB_TOKEN`; only the **deploy** SSH secrets are added to the repo. No app
  secrets in this spec (SITE_URL is public).
- Bootstrap order: push the first image (manual or a first pipeline run) -> provision droplet + DNS
  -> proxy + site up -> thereafter every merge to `main` auto-deploys.

**DNS (Namecheap).**
- In the domain's Advanced DNS, remove the default parking/redirect records, then add:
  `A  @   -> <droplet-ipv4>` and `A  www -> <droplet-ipv4>` (and optional `AAAA` if IPv6 enabled).
- TTL low (e.g. 5 min) during cutover. Caddy only obtains certs once these resolve to the droplet.

**Droplet provisioning (runbook in `deploy/docker/README.md`).**
- Ubuntu LTS droplet, **512MB/1vCPU** ($4/mo) in **TOR1**. Build is off-host, so runtime fits;
  resize to 1GB when a second cohosted site lands (RAM/CPU-only resize is reversible).
- Add a **1-2GB swap file** as OOM insurance against load spikes and image-pull/extract bumps.
- Install Docker Engine + compose plugin; create the non-root `deploy` user in the `docker` group
  with the CI public key; `ufw` allow 22/80/443.
- `docker network create edge`.
- Clone the repo, then from `deploy/docker/`: `docker compose -f compose.proxy.yml up -d`, then
  `docker compose -f compose.site.yml up -d`.

## Acceptance

- [ ] `https://matthewmaynes.com` loads the live site with a valid (non-self-signed) cert.
- [ ] `http://matthewmaynes.com` and `https://www.matthewmaynes.com` both 301/308 to
      `https://matthewmaynes.com`.
- [ ] The site container has **no** published host port; only Caddy publishes 80/443
      (`docker ps` shows 3000 only as exposed/internal).
- [ ] The droplet runs the site from the GHCR image (no `build` step on the host).
- [ ] A push to `main` triggers the pipeline: image built, pushed to GHCR (tagged `latest` + `sha`),
      and the droplet auto-pulls and restarts with the new image (verified by a visible change or
      image digest) - no manual step.
- [ ] A failing lint/test stops the pipeline before any deploy.
- [ ] Only deploy SSH secrets live in repo settings; GHCR push uses `GITHUB_TOKEN`, no PAT in CI.
- [ ] The manual bootstrap/fallback path in the runbook also picks up a newly pushed image.
- [ ] Adding a hypothetical second backend needs only a new `edge` service + Caddyfile block (no
      edits to the site stack) - confirmed by inspection.
- [ ] Security headers from `next.config.ts` are present on the live response.
- [ ] `deploy/docker/README.md` runbook reproduces the deploy from a fresh droplet.
- [ ] No secrets or real contact details added to tracked files.
