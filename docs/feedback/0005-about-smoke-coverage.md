# 0005 - About page shipped with only generic smoke coverage

## Symptom

PR #14 (spec 0003) replaced the `/about` placeholder with real content, but the route smoke
test still asserted only the route-unique `<title>` and the presence of *any* `<h1>`. The old
`PagePlaceholder` already satisfied both, so the test proved the route resolved, not that the new
content rendered. A blank body, a reverted placeholder, or the wrong page (any of which still
emit an `<h1>`) would have stayed green. Acceptance criterion #1 ("real sections, no Placeholder
badge") was effectively untested. Caught by the tester persona in review, as a major.

## Root cause

The smoke test drives every route through one generic loop keyed on `title` + "an `<h1>`
exists". When a placeholder route gains real content, nothing in that loop tightens to the new
body, so coverage silently lags the feature. This is the exact failure mode logged in feedback
0001 ("assert what the unit uniquely produces, not shared chrome"), recurring on a new page.

## Fix

Extended the smoke route table with optional `contains` (route-unique body substrings) and
`absent` (substrings that must not appear) and asserted both in the loop. `/about` now asserts a
body phrase ("never stopped building") and a caption ("The whole crew, Shea included.") are
present, and that "Placeholder" is absent.

## Learning

When a placeholder route ships real content, tighten its smoke assertion in the same PR: assert a
route-unique body string and (where a placeholder badge existed) assert it is gone. The generic
`<h1>`-exists check is a resolve probe, not a content check. Reinforces feedback 0001.
