# 0010 - Prune old GHCR container images on a schedule

## Problem

Every push to `main` builds and pushes a container image to GHCR
(`ghcr.io/mattmaynes/matthewmaynes`), tagged `latest` + `sha-<full-commit>`
(`deploy.yml`). Because the build produces a provenance attestation, **each deploy
creates three package versions**: the tagged image index plus two untagged child
manifests (the image manifest and the attestation). After ~28 deploys the package
already holds **84 versions**, and it grows unbounded - we keep the full history of
every build forever, when only a handful of recent images are ever needed (for
rollback via the pinned `sha-` tag).

A naive "keep the newest N versions" cleanup is unsafe here: the untagged children
belong to tagged indexes, so deleting a child that a kept image still references
would corrupt that image - including, in the worst case, the one `latest` points
at (the currently deployed container).

## Outcome

A scheduled workflow runs daily and keeps only the **10 most recent tagged images**
plus every manifest they reference, deleting older tagged images and orphaned
untagged manifests. The image `latest`/current deploy points at is always among the
kept set. The package stops growing without bound; a manual dry-run can preview what
would be deleted before anything is removed.

## Scope

In:
- A new workflow `.github/workflows/cleanup-images.yml`:
  - `schedule` (daily cron) + `workflow_dispatch` (with a `dry_run` input, default
    true, so a manual run previews safely).
  - Uses `dataaxiom/ghcr-cleanup-action` (pinned to a commit SHA, per the repo's
    supply-chain rule - learnings 0002) with `keep-n-tagged: 10` and
    `delete-untagged: true`. The action is referrer-aware: it preserves the
    attestation/child manifests of the images it keeps, so it cannot orphan or
    corrupt a retained image.
  - Least privilege: `permissions: packages: write` only.
- A `docs/overview/architecture.md` note under Deployment.

Out:
- Changing the build (e.g. disabling provenance to avoid the untagged children):
  provenance is a reasonable default to keep; the cleanup handles the children.
- Changing the rollback strategy or the `sha-`/`latest` tagging.
- Pruning any other package or registry.

## Approach

- **Tool choice - `dataaxiom/ghcr-cleanup-action`, not `actions/delete-package-versions`.**
  The official action's `min-versions-to-keep` counts raw versions (tagged +
  untagged) and is not manifest-reference aware, so with provenance children it
  would both keep far fewer than 10 real images and risk deleting a child of a kept
  index. The dataaxiom action is built for GHCR multi-manifest/attestation cleanup:
  `keep-n-tagged: 10` keeps the 10 newest tagged images and their referenced
  manifests; `delete-untagged` removes only genuinely orphaned untagged versions.
  Pinned to a full commit SHA to neutralize the mutable-tag supply-chain risk that
  matters doubly for an action granted delete permission.
- **Auth - `GITHUB_TOKEN` with `packages: write`.** The package is repo-linked
  (deploy pushes to it with `GITHUB_TOKEN`), so the same token can delete its
  versions. If a run ever fails on permissions (user-namespace packages can be
  stricter), the fallback is a PAT with `delete:packages` stored as a secret and
  passed to the action's `token`; documented in the workflow.
- **Safety - dry-run first.** `workflow_dispatch` defaults `dry_run: true`, so a
  manual trigger lists what would be deleted without deleting. The daily `schedule`
  run is live (`dry_run` empty -> false). We validate with a dry-run before trusting
  the live schedule.
- **Cadence.** Daily at an off-peak minute; a day's worth of accrual is tiny, so
  daily is ample and keeps the package tidy without hammering the API.

## Acceptance

- [ ] `cleanup-images.yml` exists: daily `schedule` + `workflow_dispatch` with a
      `dry_run` boolean (default true); `permissions: packages: write`; the action
      pinned to a SHA with `keep-n-tagged: 10` and `delete-untagged: true`.
- [ ] The workflow parses/validates as a valid GitHub Actions workflow.
- [ ] A manual `dry_run` execution succeeds and reports a plan that keeps the 10
      most recent tagged images (including the current `latest`) and lists older
      versions for deletion - deleting nothing.
- [ ] A live execution reduces the package to the 10 most recent tagged images plus
      their referenced manifests, and `ghcr.io/mattmaynes/matthewmaynes:latest`
      still resolves (the deployed image is intact).
- [ ] `architecture.md` documents the retention workflow.
