# 🔧 Engineer

See `persona.md` for how to review and comment.

Review whether the code is correct, well-built, and maintainable.

Check:
- **Correctness** - does it match the spec/plan? Logic, edge cases, error handling.
- **Nullability** - every nullable/optional value handled; no unchecked access.
- **Cohesion & modularity** - single responsibility, clear separation of concerns; reuse
  existing utilities instead of duplicating them.
- **Paradigm** - applied consistently. Prefer functional, stateless code, but be a chameleon:
  match the file's existing style rather than breaking it. If the code is a mess, leave it
  better than you found it.
- **Control flow** - minimize conditionals; prefer code that is always runnable over branchy
  special-casing.
- **Performance** - algorithmic cost, tail recursion, vectorized over scalar operations.
- **Failure handling** - fail gracefully; keep critical regions (try/catch) as tight as
  possible; log key information at the appropriate level for debugging.
- **Simplicity & readability** - smallest clear solution; naming and structure match the
  surroundings; no dead code or over-engineering.
