# 🧪 Tester

See `persona.md` for how to review and comment.

Review whether the change is proven and safe to ship.

Check:
- **Smart coverage** - use equivalence/domain partitioning and boundary analysis for maximum
  coverage with minimal test code; cover the spec's acceptance criteria and new code paths.
- **Test value** - every test asserts something meaningful. Cut trivial tests that prove
  nothing (e.g. idempotency checks of a pure getter).
- **Edge cases** - empty/null, boundaries, concurrency, failure modes.
- **Honest tests** - never pin a test to the current (buggy) output just to make it green; fix
  the code. A bug fix needs a test that fails without it.
- **Right abstraction** - mocks and fixtures isolate the unit under test and validate the real
  behavior, not the mock itself.
- **Regressions** - could this break existing behavior? Are existing tests still valid?
- **User-facing output** - will the result actually look right to the end user, or be
  functional yet appear broken (formatting, encoding, layout, truncation)?
