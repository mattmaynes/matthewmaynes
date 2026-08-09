# 0027 - The prewarm test fails on a re-run against the same build

## Symptom

`npm test` passes, then fails on the very next invocation with nothing changed:

```
✖ prewarm warms the home page images and flips MISS -> HIT
  AssertionError: expected a cold image request to MISS before warming
  'HIT' !== 'MISS'
```

Surfaced while iterating on spec 0037 (the vector favicon), where the suite was run several
times against one build. It looks alarming - a red suite mid-change, on a test with nothing to
do with the change in flight - and the instinct is to go hunting in the diff.

## Root cause

Stale state, not a regression. `tests/prewarm.test.ts` boots the standalone server and asserts a
sampled image flips `X-Nextjs-Cache` MISS -> HIT, which requires starting cold. But
`next/image` writes its optimized variants to `<serverDir>/.next/cache/images`, and that
directory outlives both the server process and the test run. The `before` hook also reuses an
existing build (it only runs `next build` when `server.js` is missing), so nothing ever resets
it. Second run: the "cold" request is served from the previous run's cache and reports HIT.

CI never sees this - it builds fresh on every job, so the cache is always empty - which is
precisely why it survived: the only environment that reproduces it is a developer's machine
mid-iteration, where a red test is easiest to misread as a real break.

## Fix

Reset the image cache in the `before` hook, after the standalone dir is assembled and before the
server is spawned, so every run starts genuinely cold. The assertions are untouched: this
restores the precondition the test always meant to have, rather than relaxing what it checks. A
broken pre-warmer still fails it.

## Learning

**A test that asserts a cold-start behaviour must CREATE the cold state, not assume it.** The
precondition here lived in the environment (an empty cache directory) rather than in the test, so
it held exactly once per build and then silently rotted. Any test keyed on a first-time effect -
a cache MISS, a one-shot migration, a "first request" path, an empty table - owns the setup that
makes it first. Otherwise it is order-dependent and build-dependent, and it degrades in the worst
possible way: green in CI, intermittently red locally, so the failure trains developers to
distrust the suite rather than the code.

The corollary is about where flakes hide: **an environment-dependent test can be invisible to CI
precisely because CI is clean.** A fresh-build-per-job pipeline masks every stale-state bug, so
"CI is green" is not evidence the suite is deterministic. Re-running the suite twice without
rebuilding is a cheap check for this class of bug and worth doing when a test touches any
persisted artifact.
