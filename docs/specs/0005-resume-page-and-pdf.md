# 0005 - Resume page + in-sync PDF download

## Problem

`/resume` is still the walking-skeleton placeholder: a `PagePlaceholder` badge, a headshot card,
and a stub paragraph. The real resume content lives only in `context/resume.md` - which is
**git-ignored and docker-ignored**, so it is never present during a CI or Docker build and cannot
be read at render time. `features.md` already commits to this page being "rendered from a
structured resume source" that **excludes** phone/email/full address, with a **download PDF**
button whose PDF is "generated from the page itself ... so it is always contact-free and in sync."

This spec delivers that: a real resume page built from tracked, scrubbed data, plus a downloadable
PDF rendered from the actual page so the two never drift. It also hardens the privacy guarantee
that makes a public repo safe - an `AGENTS.md` rule that personal contact and precise-location data
is stripped before anything is committed.

Audience (from `0003`): the resume page serves the hiring-evaluation / recruiter-screen job - more
depth than the PDF, skimmable, and printable.

## Outcome

When done:

- Visiting `/resume` shows the real resume - leadership principles, skills, tooling, full work
  history, certifications, education - built from Harbor typography and color tokens, with no
  "Placeholder" badge and no stub copy.
- The page shows **no** phone, email, or street address; location is shown no more specifically
  than region ("Ontario, Canada"), consistent with `0003`/`site.ts`.
- A **Download PDF** button serves `/resume.pdf`, a clean print rendering of the same page.
- The PDF is produced from the actual rendered page (print stylesheet + headless Chromium), so the
  page and the PDF are always in sync by construction - not two hand-maintained artifacts.
- PDF regeneration is a build step that **only runs when the resume page actually changes**
  (content-hash gated), so unrelated builds stay fast and need no browser.
- `AGENTS.md` carries an explicit rule: this is a public site and public repo; personal contact
  info (phone, email, street address, postal code) and precise location must be stripped before
  commit. The private master stays in git-ignored `context/`.
- Responsive (320px up), themed (light/dark), ASCII-only per Trellis; `lint`, `build`, `test` green.

## Scope

**In**

- `src/lib/resume.ts` - tracked, typed, **scrubbed** resume data (no Contact section): summary,
  leadership principles ("How I Lead"), skills, software/tools, work history (company, title,
  location, dates, bullets), certifications, education. Derived by hand from `context/resume.md`
  with the Contact block and any street/postal/phone/email omitted; region only.
- Rewrite `src/app/resume/page.tsx`: drop `PagePlaceholder`; render the data as real sections in
  the shared layout, matching the about/resume token patterns (`max-w-[1200px]`, `text-h1/h2`,
  `text-body`, `text-text` / `text-text-muted`, `Badge`). Keep the headshot + name/title header.
  Stays a Server Component (static data, no client boundary).
- A **Download PDF** link/button (existing `Button asChild` + `<a href="/resume.pdf">`).
- Print styles so the PDF renders clean: hide site chrome (header, footer, theme toggle, the
  download button itself), force the light palette, and lay the content out for paper. Scoped to
  `@media print` (and/or a print-only render path) so the on-screen page is untouched.
- `scripts/generate-resume-pdf.mjs` - boots the built standalone server on an ephemeral port,
  then shells out to **headless Chrome** (`--headless=new --no-pdf-header-footer
  --virtual-time-budget=... --print-to-pdf=public/resume.pdf <url>/resume`), and shuts the server
  down. Print media (`@media print`) and page geometry (`@page`) apply automatically. Also writes
  a sidecar `public/resume.pdf.hash` = a deterministic hash of the **rendered resume HTML** (stable
  input, unlike non-deterministic PDF bytes).
- **No npm dependency for PDF rendering.** The script locates a Chrome/Chromium binary, honoring a
  `CHROME_PATH` env override and falling back to the common macOS/Linux install paths. Chrome is
  needed only to author the PDF, never at runtime, and never enters the alpine Docker image. If CLI
  font-timing proves flaky, the documented fallback is `playwright-core` (the browserless `-core`
  lib pointed at the same system Chrome) - a small lib, not a bundled browser download.
- **Freshness gating:** the script is a no-op when the current rendered-HTML hash matches the
  committed `resume.pdf.hash` (so a build that did not change the resume skips Chromium entirely).
- `public/resume.pdf` and `public/resume.pdf.hash` are **committed** tracked artifacts, so the
  Docker/runtime path serves a static file and never runs a browser.
- CI: a verify step that runs `resume:pdf` **only when resume inputs changed** (paths filter on
  `src/app/resume/**`, `src/lib/resume.ts`, the print styles, the generator script) and fails if
  the committed hash is stale ("run npm run resume:pdf and commit"). Uses the runner's preinstalled
  Chrome via `CHROME_PATH`; avoids binary-PDF diff flakiness by comparing the HTML hash, not PDF
  bytes.
- `AGENTS.md`: a short "Public repo - strip PII" rule (see *Draft: AGENTS.md note*).
- Smoke test: extend `tests/smoke.test.mjs` to assert `/resume` still renders its `<h1>` and that
  `GET /resume.pdf` returns `200` with `content-type: application/pdf`.
- Reflect: update `overview/features.md` (`/resume` placeholder -> live) and `architecture.md`
  (PDF is committed + hash-gated, not a per-build artifact); log any build-friction learning.

**Out** (later / other specs)

- A Markdown renderer / MDX for the resume (chose structured TS data; revisit only if the blog's
  MDX pipeline later wants to own this).
- Bundling a browser as an npm dependency, or running a browser on every Docker/CI build
  (rejected: heavier, fragile on alpine; headless system Chrome + committed-artifact + change-gating
  gives the same in-sync guarantee with zero deps).
- Resume content changes beyond scrubbing (rewording bullets, new roles) - this ports the existing
  resume faithfully, minus PII.
- A retasked print path for other pages; print CSS here is resume-scoped.

## Approach

- **Single source of truth = the page.** Both the on-screen page and the PDF render from
  `src/lib/resume.ts` through `src/app/resume/page.tsx`; the PDF is literally that page printed.
  Editing the data updates both, and the hash gate forces the PDF to be regenerated and committed
  before CI passes when the page changed.
- **Privacy by construction.** Tracked data (`resume.ts`) never contains phone/email/street/postal;
  `context/resume.md` stays the private master (git-ignored, docker-ignored). The `AGENTS.md` rule
  makes the expectation explicit for any future human or agent edit.
- **Why headless Chrome CLI + committed PDF (not a bundled browser, not CI-every-build):** Chrome
  has built-in `--print-to-pdf`, so no npm dependency is needed - matching the repo's dependency-
  light ethos. The user wants it generated from the page and kept in sync, but only re-run when the
  resume changes. A committed `public/resume.pdf` plus an HTML-hash gate delivers exactly that: the
  deploy/runtime path stays browser-free, builds that don't touch the resume skip Chrome, and CI
  only launches Chrome when resume files changed.
- **Deterministic gate.** Chrome's print-to-PDF output is not byte-stable (embedded IDs/dates), so
  freshness is judged by hashing the rendered resume HTML, which is stable. The PDF bytes are not
  diffed.
- **Print rendering.** Prefer a `@media print` stylesheet on the real page (hide header/footer/
  toggle/download button, pin light tokens, paper margins). If `@media print` cannot cleanly drop
  the layout chrome, fall back to a `?print=1` query the generator sets, rendering a chrome-less
  variant - decided during build, noted in the plan.
- No new dependencies at all - PDF rendering uses the system Chrome via its CLI. Page stays a
  Server Component.
- ASCII-only copy; spaced hyphens, straight quotes, per `docs/rules/`.

## Draft: AGENTS.md note

> ## Public repo - strip PII before commit
>
> This site and its repository are public. Never commit personal contact info - phone, email,
> street address, or postal code - or a precise home location. Show location no more specifically
> than region (for example "Ontario, Canada"). The private resume master lives in git-ignored
> `context/`; only its scrubbed derivative (`src/lib/resume.ts`) is tracked.

## Acceptance

- [ ] `/resume` renders real content (summary, How I Lead, skills, tools, full work history,
      certifications, education) with no "Placeholder" badge and no stub copy.
- [ ] The page and the PDF contain **no** phone, email, street address, or postal code; location is
      region-only.
- [ ] A Download PDF control links to `/resume.pdf`; the file renders as a clean, chrome-free,
      light-themed print of the page.
- [ ] `npm run resume:pdf` regenerates `public/resume.pdf` + `public/resume.pdf.hash` from the
      actual page, and is a no-op when the resume HTML is unchanged.
- [ ] CI fails if resume inputs changed but the committed PDF hash is stale; CI does **not** run
      Chromium when the resume is untouched.
- [ ] `AGENTS.md` contains the public-repo / strip-PII rule.
- [ ] Responsive from ~320px up; light and dark both read cleanly (tokens only); ASCII-only.
- [ ] `npm run lint`, `npm run build`, `npm test` pass; smoke test asserts `/resume` `<h1>` and
      `GET /resume.pdf` -> `200 application/pdf`.
- [ ] `features.md` `/resume` row updated to live; `architecture.md` notes the committed,
      hash-gated PDF.

## Notes

- Constraint that drives the whole design: `context/` is in `.gitignore` **and** `.dockerignore`,
  so the rendered content must come from a tracked, scrubbed source - it cannot read `context/`.
- Source facts: `context/resume.md` (private). Voice/tokens: `docs/design/brand-guide.md`.
- PDF rendering resolved to headless system Chrome via CLI (`--print-to-pdf`), no npm dependency;
  `playwright-core` against the same system Chrome is the documented fallback only if CLI font
  timing proves unreliable.
