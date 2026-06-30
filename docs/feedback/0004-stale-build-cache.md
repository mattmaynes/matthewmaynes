# 0004 - Stale build cache ships old source

## Symptom

The footer change (#11) merged, the pipeline went fully green (verify + build + deploy), the
container was recreated with the new `sha-<commit>` image - yet the live site, the VM container,
and even the pulled CI image all still served the old "Built by" footer. Every "successful" deploy
was shipping stale HTML.

## Root cause

The build job used a cross-run layer cache:

```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

The build log showed the `COPY` layers as `CACHED`. buildx restored a **stale `COPY . .` layer**
from the gha cache, so `RUN npm run build` ran against the *old* source tree and prerendered the
old footer. The image digest was new (new tag) but its contents were old. Source on `main` was
correct the whole time; only the built artifact was stale.

## Fix

Drop the cross-run build cache - `no-cache: true` on `docker/build-push-action`. A clean build each
run is the reliable default; this app builds in about a minute, so the lost cache time is
negligible next to shipping correct bytes.

## Learning

A green deploy is not proof the image reflects HEAD: a cross-run build cache can restore an
outdated `COPY` layer and ship stale source while every job reports success. Verify a deploy by
checking the *running container's* output against the change, not just the job status. For a small
app, prefer no cross-run build cache (correctness) over caching (speed); if caching is needed
later, key it so a source change always invalidates the copy+build layers. Rolled into
`overview/learnings.md`.
