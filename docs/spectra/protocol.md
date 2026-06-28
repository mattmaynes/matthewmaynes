# Spectra Protocol

Spec-driven development with learning feedback loops. Follow this for every change.

## Artifacts

| Dir | Holds | Name |
|---|---|---|
| `docs/specs/` | feature specifications | `NNNN-<slug>.md` |
| `docs/plans/` | build plans for specs/feedback | `NNNN-<slug>.md` |
| `docs/feedback/` | bugs + process feedback (learning input) | `NNNN-<slug>.md` |
| `docs/overview/` | living docs: `project` `features` `architecture` `learnings` | fixed |

`NNNN` = zero-padded, next integer in that dir. Slug = kebab-case.

## 0. Orient (before any change)

The `docs/overview/` living docs are the project's memory - read them first, they are
**inputs**, not just the outputs you write in §6:

- **`learnings.md`** - past mistakes and what to do differently. **Apply them**; never
  re-make a logged mistake.
- **`features.md`** & **`architecture.md`** - what already exists and how it's structured.
  Read them to understand the project so you extend it rather than duplicate or break it.

## 1. Route the change

- **Trivial** (a line, a typo, an obvious fix) → implement directly. Skip to step 6.
- **Net-new feature** → write a spec (§2), get developer approval before building.
- **Bug or feedback** → write a feedback doc (§3) so it becomes a learning.

## 2. Spec (features)

**One spec is one independently shippable feature, and maps to one PR.** A spec is the
smallest change that ships on its own and leaves the system whole - working software, working
docs. Two features that can ship apart belong in two specs, not one batched spec. Shared setup
a group needs - a recipe, infra, new deps - lives in the *first* spec of the group; the rest
reference it and stay small. Small specs review cleanly and map 1:1 to a PR.

Write `docs/specs/NNNN-<slug>.md`:
- **Problem** - what/why, who it's for.
- **Outcome** - observable behavior when done.
- **Scope** - in / out.
- **Approach** - sketch; key decisions & trade-offs.
- **Acceptance** - checklist proving done.

Stop and get developer review before planning.

## 3. Feedback (bugs / process)

Write `docs/feedback/NNNN-<slug>.md`:
- **Symptom** - what went wrong / what hurt.
- **Root cause** - why (best understanding).
- **Fix** - the change.
- **Learning** - what to do differently next time. Feeds `overview/learnings.md` in step 6.

## 4. Plan

If the work is multi-step, convert the spec/feedback into `docs/plans/NNNN-<slug>.md`:
ordered steps, files touched, verification. Reference the source `NNNN`.

## 5. Build, test, review, merge

1. **Build** in a **git worktree** on a new branch - `git worktree add .worktrees/<slug>
   -b <slug>` - leaving your primary checkout on `main`. A sub-agent does the build inside
   the worktree; remove it (`git worktree remove`) once merged.
2. **Test** - run the repo's test suite; fix the code or the tests until green.
   Always do this **before committing**. No suite yet? Add the test that proves this change.
3. **Commit**, then open a **PR**.
4. **Review** - scope from the diff first. Pure docs/formatting, no behavior change →
   **no personas** (self-review, merge). Else review with the personas **enabled in
   `docs/spectra/personas.config`** whose facet the change touches - not all by reflex. Triggers
   for the four shipped-by-default personas (apply each only if it's still listed in the config):
   - **engineer** - non-trivial code/logic (skip tests-only)
   - **tester** - observable behavior changed
   - **architect** - boundaries, deps, or data-flow changed
   - **security** - auth, input, secrets, consumer-run scripts, or new deps

   Also scope in any **other enabled** persona whose facet the change touches - the optional
   designer/compliance/analytics (off by default; `/spectra-persona-enable` to turn on). For the
   👤 **user (ICP)** personas, read each `docs/spectra/personas/user*.md` (a legacy `user.md` and
   any `user-<slug>.md`) and scope in **every** one whose **Applies when** block matches this
   change while its **Skip when** doesn't; if none match - or none exist - no user persona reviews.
   Manage these with `/spectra-add-user`, `/spectra-update-user`, `/spectra-remove-user`,
   `/spectra-list-users`.

   Spawn the selected personas as sub-agents. Each reads `docs/spectra/personas/persona.md`
   (how to review, comment, and the format) plus its own `docs/spectra/personas/<persona>.md`
   (what to look for), then posts findings **as inline comments anchored to file:line** -
   never a single detached top-level comment. Treat every **major** and **blocker** as
   feedback: capture it in `docs/feedback/` and roll the lesson into `overview/learnings.md`
   (step 6).
5. **Address** every comment; re-test; push fixes.
6. **Merge** on developer approval.

## 6. Reflect (before concluding - always)

Close the loop you opened in §0: the docs you read in are the docs you write back.
Update only what changed:
- mission/direction shifted → `overview/project.md`
- new capability → `overview/features.md`
- structure/boundaries changed → `overview/architecture.md`
- a lesson from feedback or friction → `overview/learnings.md`

A **learning** is what you'd do *differently* next time, distilled from feedback or friction -
**not** a description of what you shipped or why you designed it that way. Describing the feature
is `features.md`; the design rationale is `architecture.md`. No feedback, no learning - don't
manufacture one to fill the section.

A `pre-commit` hook reminds you if specs/plans/feedback changed without an overview update.
The reminder is non-blocking - skip it only when truly nothing changed.
