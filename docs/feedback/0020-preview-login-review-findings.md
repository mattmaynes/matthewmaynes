# 0020 - Preview login gate (0036) review findings

## Symptom

The spec 0036 persona review surfaced three majors on an otherwise sound implementation (security
confirmed the gate is un-bypassable, fail-closed, and leak-free in code):

1. **No regression test that `PREVIEW_PASSWORD` stays out of the client bundle** - the app's first
   auth secret shipped with the property holding only by convention.
2. **The `/v1/login` verify handler shipped with no end-to-end test** - acceptance "right password
   sets the cookie, wrong password errors with no cookie" was only covered indirectly by unit tests,
   so a revert of the handler's cookie-set / redirect / no-mint-on-failure path would have gone green.
3. **A hand-rolled `<input>` on the login page** duplicated the Canopy `Input` seed and, because it
   carried no `aria-invalid:` styling, rendered the error state with no visual change (only separate
   red text), and missed the seed's iOS-zoom-safe sizing (feedback 0017).

## Root cause

Each is a "new surface, old guard not extended" gap: the bundle-secret test existed but only knew
about the PostHog key; the acceptance criteria were unit-tested but the new HTTP route had no smoke
test; the design system's field treatment lives in a seed that was bypassed by hand-rolling.

## Fix

Extended the client-bundle test to assert the password value is absent; added a `POST /v1/login`
smoke test (success mints a session + redirects to `next`; failure redirects to `/login?error=1` and
mints nothing); swapped the hand-rolled input for the `<Input>` seed with `aria-describedby` on the
error. Also: login failures (429/403) now redirect back to the rendered form instead of returning
JSON, and the proxy's OG-bypass uses a precise path regex.

## Learning

Two generalise (rolled into `overview/learnings.md`):
- **A new server-only secret needs a structural "absent from the client bundle" test**, not just the
  convention of reading it server-side. Extend the existing bundle-grep guard for every new secret -
  the property is one `NEXT_PUBLIC_`/import mistake away from silently breaking on a public repo.
- **Reuse the design-system field seed (`Input`), never hand-roll an `<input>`.** A raw input silently
  drops the seed's error (`aria-invalid`), disabled, placeholder, and iOS-zoom treatment, so the
  error state looks identical to the resting state. Hand-rolling a component the design system already
  ships is a review red flag.
