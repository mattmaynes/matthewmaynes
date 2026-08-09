# Conventions

How code itself is written on rogueoak projects - the shape of the code, not the prose around it
or the process of shipping it. Terse on purpose: more will land here over time, so keep each rule
a single, checkable line. For how to write and ship (tests, commits, releases) see
`guidelines.md`; for public-facing voice see `language.md`.

## APIs

1. Version every API with the version in the URL path: `/v1/`, `/v2/`. Reserve a new number for a
   breaking change.
   - Yes: `GET /v1/users/42`
   - No:  `GET /users/42`, `GET /users/42?version=1`, or a version pinned only in a header.

## Control flow

1. Never nest logic more than 4 levels deep. `if`/`else`, loops, lambdas, and callbacks each add a
   level. Past 4, extract a function or invert with an early return.

## Readability

1. Avoid ternary operators, especially in JSX - they are hard to read. Hoist the logic above the
   JSX block and assign the result to a variable or component, then render that.
   - Yes: `const badge = isActive ? <Active /> : <Inactive />` above the block, then `{badge}`.
   - No:  `<div>{isActive ? <Active /> : <Inactive />}</div>` inline.

## Comments

1. Comment sparingly, and only for non-intuitive code. Well-named, well-shaped code documents
   itself; a comment that restates what the code plainly does is redundant and becomes tech debt,
   since it has to be kept in sync as the code changes. When you do comment, explain the *why* the
   code cannot show - a constraint or non-obvious reason - not the *what* it already says.
   - Yes: `// Back off: the upstream API rate-limits bursts and drops the extras.`
   - No:  `i += 1  // increment i by one`

## Styling

1. Style with the design system tokens. Do not invent custom styling. If you need a style the
   design system does not support, pause and ask about adding it to the design system rather than
   hardcoding a one-off value.
   - Yes: `color: var(--color-text-muted)`
   - No:  `color: #6b7280` or another hardcoded, off-token value.
