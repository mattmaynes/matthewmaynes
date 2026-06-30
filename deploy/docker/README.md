# Deploy: Docker on a DigitalOcean droplet

Production hosting for matthewmaynes.com. A single droplet runs two Docker Compose
stacks on a shared `edge` network:

```
internet -> :80/:443  Caddy (compose.proxy.yml, auto-HTTPS)
                       |  edge network (routes by hostname)
                       +--> site:3000   (compose.site.yml, GHCR image, internal only)
                       +--> (future) another site, same pattern
```

- `compose.proxy.yml` + `Caddyfile` - the edge proxy. Owns ports 80/443, terminates TLS,
  reverse-proxies to backends by hostname. Brought up once per droplet.
- `compose.site.yml` - the site. Pulls `ghcr.io/mattmaynes/matthewmaynes:latest`, exposes 3000
  only on `edge` (no host port), restarts unless stopped.

Images are built and pushed by CI (`.github/workflows/deploy.yml`), never on the droplet, so a
512MB box never runs a memory-hungry Next build.

---

## 1. One-time droplet provisioning

Create the droplet in the DigitalOcean console: **Ubuntu LTS, 512MB / 1 vCPU, region TOR1**, with
your personal SSH key added so you can log in as `root`. Then SSH in as `root` and run:

### 1a. Swap (OOM insurance on a 512MB box)

```bash
fallocate -l 2G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

### 1b. Docker Engine + Compose plugin

```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker --version && docker compose version
```

### 1c. Git (needed by the deploy step)

```bash
apt-get update && apt-get install -y git
```

### 1d. The `deploy` user (CI logs in as this, key-only, in the docker group)

```bash
adduser --disabled-password --gecos "" deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
# Paste the CI *public* key (the .pub matching the DROPLET_SSH_KEY secret):
echo 'ssh-ed25519 AAAA...your gha_deploy.pub... gha-deploy@matthewmaynes' \
  > /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
usermod -aG docker deploy   # run AFTER Docker is installed, else the group is missing
```

Verify from your laptop (this is exactly what CI does):

```bash
ssh -i ~/.ssh/gha_deploy deploy@<droplet-ip> 'whoami && groups'   # -> deploy ... docker
```

### 1e. Firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

### 1f. The shared edge network

```bash
docker network create edge
```

### 1g. Clone the repo as `deploy` (the deploy step does `cd ~/matthewmaynes`)

```bash
sudo -u deploy git clone https://github.com/mattmaynes/matthewmaynes.git /home/deploy/matthewmaynes
```

---

## 2. First bring-up (bootstrap)

1. **Make the GHCR package public** so the droplet pulls without a login: after the first image is
   pushed, open the package at `ghcr.io/mattmaynes/matthewmaynes` -> Package settings -> change
   visibility to **Public**.
2. **Get the first image into GHCR.** Easiest: push any commit to `main` and let the pipeline build
   it. Or build/push manually from your laptop (see section 5).
3. **Bring up the stacks** (as `deploy`, from the clone):

   ```bash
   cd ~/matthewmaynes/deploy/docker
   docker compose -f compose.proxy.yml up -d
   docker compose -f compose.site.yml pull
   docker compose -f compose.site.yml up -d
   docker ps   # caddy publishes 80/443; site shows 3000 only as internal
   ```

Caddy will not obtain certificates until DNS (section 3) points the names at this droplet.

---

## 3. DNS (Namecheap)

In the Namecheap dashboard: **Domain List -> Manage -> Advanced DNS**. Remove the default
parking / URL-redirect records, then add:

| Type | Host | Value | TTL |
|---|---|---|---|
| A | `@` | `<droplet-ip>` | 5 min (raise later) |
| A | `www` | `<droplet-ip>` | 5 min |

Add `AAAA` records too if the droplet has IPv6 enabled. Once these resolve, Caddy issues certs
within a minute; `https://matthewmaynes.com` goes live and `www` + `http` redirect to it.

---

## 4. Ongoing deploys (automatic)

Every push to `main` runs `.github/workflows/deploy.yml`: **verify** (lint, build, test) ->
**build** (push `latest` + a `sha-<commit>` tag to GHCR) -> **deploy** (SSH in, `git pull`,
`compose ... pull && up -d`). A failed verify or build never deploys. Nothing to do by hand.

GitHub repo secrets the pipeline needs (Settings -> Secrets and variables -> Actions):

| Secret | Value |
|---|---|
| `DROPLET_HOST` | droplet public IPv4 |
| `DROPLET_USER` | `deploy` |
| `DROPLET_SSH_KEY` | the **private** deploy key (`~/.ssh/gha_deploy`) |

---

## 5. Manual deploy and rollback (fallback)

Build and push from your laptop (note `linux/amd64` - the droplet is amd64; authenticate once with
a GHCR PAT that has `write:packages`, or `gh auth token`):

```bash
docker buildx build --platform linux/amd64 \
  -t ghcr.io/mattmaynes/matthewmaynes:latest --push .
```

Pull on the droplet (as `deploy`):

```bash
cd ~/matthewmaynes/deploy/docker
docker compose -f compose.site.yml pull && docker compose -f compose.site.yml up -d
```

**Roll back** to a known-good commit using its immutable `sha` tag:

```bash
docker pull ghcr.io/mattmaynes/matthewmaynes:sha-<commit>
docker tag  ghcr.io/mattmaynes/matthewmaynes:sha-<commit> ghcr.io/mattmaynes/matthewmaynes:latest
docker compose -f compose.site.yml up -d
```

---

## 6. Adding a second cohosted site later

1. Add its service to a new `compose.<name>.yml` on the `edge` network (expose its port, no host
   publish).
2. Add a hostname block to the `Caddyfile`: `name.example.com { reverse_proxy <service>:<port> }`.
3. `docker compose -f deploy/docker/compose.proxy.yml restart` to reload routes.

No change to the site stack. If RAM gets tight, resize the droplet to 1GB (RAM/CPU-only resize is
reversible).
