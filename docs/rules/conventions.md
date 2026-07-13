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
