# 0002 - Server deploy: build plan

Source spec: `docs/specs/0002-host-deploy.md`.

## Files

| File | Change |
|---|---|
| `deploy/docker/compose.proxy.yml` | new - Caddy edge proxy (owns 80/443), joins external `edge` |
| `deploy/docker/Caddyfile` | new - apex auto-HTTPS -> `site:3000`; `www` -> apex redirect |
| `deploy/docker/compose.site.yml` | new - production site from GHCR image, `expose` only, on `edge` |
| `.github/workflows/deploy.yml` | new - verify -> build+push GHCR -> SSH deploy on push to `main` |
| `docs/overview/architecture.md` | update - Deployment + CI/CD sections reflect the real setup |

Root `docker-compose.yml` is intentionally untouched: it stays the local build/run compose.

## Steps

1. **Edge proxy** - `compose.proxy.yml` + `Caddyfile`. Caddy `2-alpine`, publish 80/443 (+443/udp
   for HTTP/3), mount `Caddyfile` read-only, named volumes for `/data` (ACME state) + `/config`,
   external `edge` network. No ACME email in the file (privacy: no personal address in git).
2. **Site stack** - `compose.site.yml`. `image: ghcr.io/mattmaynes/matthewmaynes:latest`,
   `container_name: site`, `expose: ["3000"]` (no host port), env `NODE_ENV`/`SITE_URL`,
   `restart: unless-stopped`, external `edge`. Healthcheck comes from the image.
3. **Pipeline** - `.github/workflows/deploy.yml`. Jobs: `verify` (npm ci, lint, build, test) ->
   `build` (buildx, login via `GITHUB_TOKEN`, push `latest` + `sha`, gha cache) -> `deploy`
   (raw SSH with the deploy secrets: `git pull` + `compose -f deploy/docker/compose.site.yml pull
   && up -d`, then `docker image prune -f`). `permissions: packages: write`; concurrency guard.
4. **Runbook** - operator runbook kept privately (git-ignored, not in the repo). VM create (~512MB),
   swap, Docker install, `deploy` user + CI key + docker group, `ufw`, `edge` network, repo clone,
   first bring-up of proxy + site, registrar DNS, GHCR-public step, rollback by `sha` tag, fallback.
5. **Reflect** - update `architecture.md` Deployment/CI-CD to match (network topology, GHCR,
   pipeline, `deploy/docker/` layout).

## Verification (before commit)

- `docker compose -f deploy/docker/compose.proxy.yml config` and `... compose.site.yml config`
  parse clean (with `edge` declared external).
- `caddy validate` the `Caddyfile` via `docker run --rm caddy:2-alpine`.
- Workflow YAML parses (python `yaml.safe_load`); job graph `verify -> build -> deploy` is correct.
- Repo gate green: `npm run lint`, `npm run build`, `npm test` (the same checks CI runs).
- Inspection: site stack has no published host port; adding a 2nd backend needs only an `edge`
  service + Caddyfile block.

## Out of scope (per spec)

Contact-form SMTP, monitoring/backups, staging, CDN tuning. Live cert issuance + DNS cutover are
operator steps in the runbook (need the real server + DNS), not part of the local build/test.
