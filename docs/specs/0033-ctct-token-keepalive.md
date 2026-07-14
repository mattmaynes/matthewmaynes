# 0033 - Keep the Constant Contact refresh token alive (cron keepalive + alert)

## Problem

The blog subscribe endpoint (`/v1/subscribe`, spec 0018) mints a Constant Contact access
token from a long-lived refresh token stored in the host-only `.env.site`. On 2026-07-14 the
form began returning 500 for every visitor; the CTCT token endpoint answered
`invalid_grant` / "refresh token is invalid or expired".

Root cause: the CTCT key is configured for **long-lived** refresh tokens, but a long-lived
token still **expires after ~180 days of inactivity**, and that idle clock resets only when
the token is used. The route mints lazily - only on a real subscribe, then it caches the
access token ~24h - so on a low-traffic blog the refresh token can sit unused past 180 days
and expire. Nothing exercises it in the meantime (deploys do not: the cache is lazy). The
first person to subscribe after expiry hits a 500, and there is no earlier signal.

The token also cannot be refreshed once dead - re-minting needs a human browser approval
(the key is a device-flow public client) - so the fix must *prevent* expiry, not react to it.

For: the site owner (subscribe stays up without manual token babysitting) and every blog
visitor who tries to subscribe.

## Outcome

Observable when done:

1. A **daily host cron** exercises the refresh token out-of-band (independent of visitor
   traffic), so the 180-day idle clock never runs out. 180-day window / daily run ~= 180x
   safety margin.
2. On any refresh failure, the owner gets an **email alert via Resend** (reusing the
   contact-form `RESEND_API_KEY` / `CONTACT_TO_EMAIL` / `CONTACT_FROM_EMAIL`) that names the
   failure and points at the re-auth runbook - hours to days before a visitor could hit a 500
   (the live access token is still valid for up to 24h after the refresh token dies).
3. The keepalive is **idempotent and side-effect-free on success**: a long-lived token
   returns the same value, so `.env.site` is untouched. If CTCT ever returns a *different*
   refresh token (config drift to rotating), it is persisted atomically with a backup, and
   the log flags that the container must be recreated to load it.
4. Secrets are never hard-coded (the repo is public): the script reads them from `.env.site`
   at runtime and keeps tokens out of its log (status/error field only).

## Approach

The token-refresh logic lives in the versioned, unit-tested **`ctct` CLI**
(`@mattmaynes/ctct-cli`, `ctct refresh-token`), not in a hand-rolled script - so it is one
tested implementation shared across every site instead of duplicated `curl` in each repo.

- The CLI runs as a container (the box has no Node runtime): a published image
  `ghcr.io/mattmaynes/ctct-cli` is pulled and run with the site's `.env.site` passed in.
  `ctct refresh-token` exchanges `CTCT_REFRESH_TOKEN` for a fresh access token (stateless -
  it never writes the token back) and exits non-zero when the refresh fails.
- A small host wrapper `~/ctct-refresh/ctct-keepalive.sh <env-file> <label>` runs
  `docker run --rm --env-file <env-file> ghcr.io/mattmaynes/ctct-cli refresh-token`, logs
  `OK`/`FAIL` (never the minted token), and on failure emails a Resend alert. It lives on the
  host (outside the git checkout, so a deploy `git reset --hard` never disturbs it).
- Host crontab (deploy user): `17 8 * * *` -> the wrapper for this site's `.env.site`.
- One-time re-auth (when a token is truly dead) uses the **device flow** (`ctct login`, or the
  raw device grant); steps live in the private `context/deploy-runbook.md`.

## Notes

Implemented live on 2026-07-14 as emergency remediation (the form was down), then captured
here. A fresh matthewmaynes-owned token was minted via the device flow and installed, the
container recreated, and a live subscribe verified `{ ok: true }`; the failure-alert path was
tested end to end (bogus token -> Resend HTTP 200). The misleading "non-rotating / nothing to
persist" comments in `src/lib/subscribe.ts` were corrected, and the failure mode recorded in
`docs/overview/learnings.md`. The `ctct refresh-token` command + container image were added in
`@mattmaynes/ctct-cli` (its own repo/PR).

Out of scope: switching the key to rotating refresh tokens (more secure, but would require
the app and cron to coordinate a single-writer token store and recreate the container on
every rotation - unjustified for this endpoint). The cohosted rogueoak site shares the CTCT
account and has the same latent risk; it gets the same keepalive in its own repo.
