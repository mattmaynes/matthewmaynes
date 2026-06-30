# 0003 - Test glob fails on Node 20 in CI

## Symptom

The first CI run on `main` (the new deploy pipeline, spec `0002`) went red at `npm test`:

```
Could not find '/home/runner/work/matthewmaynes/matthewmaynes/tests/**/*.test.mjs'
```

The same `npm test` passed locally and in a pre-merge clean export, so it slipped through.

## Root cause

The script was `node --test "tests/**/*.test.mjs"`. The glob is **quoted**, so the shell never
expands it - Node has to. Node's `--test` only resolves glob patterns on **Node 21+**; on Node 20
it treats the argument as a literal path and finds nothing. The pre-merge checks passed only
because the local Node was newer than the project's target. CI pins Node 20 to match the
`node:20-alpine` runtime, which is where the gap showed.

## Fix

`node --test tests/*.test.mjs` - an unquoted, single-level glob the shell expands to explicit file
paths, so Node gets real paths and the version's glob support is irrelevant. Verified by running
`npm ci && npm run build && npm test` inside a real `node:20-alpine` container (12/12 pass).

## Learning

Pin CI to the **production runtime's** Node version, and don't lean on tooling behavior newer than
that runtime. "Passes on my machine" is not "passes on the target" when the local toolchain is
ahead - run the suite on the pinned Node before calling it green. Rolled into `overview/learnings.md`.
