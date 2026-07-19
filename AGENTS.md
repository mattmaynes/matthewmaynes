
## Public repo - strip PII before commit

This site and its repository are **public**. Never commit personal contact info - phone, email,
street address, or postal code - or a precise home location. Show location no more specifically
than region (for example "Ontario, Canada"). The private resume master lives in git-ignored
`context/`; only its scrubbed derivative (`src/lib/resume.ts`) is tracked and rendered. The
generated `public/resume.pdf` is built from that scrubbed source, so it stays contact-free too.

## Privacy policy - stamp the date when the content changes

When you edit the privacy policy (`src/app/privacy/page.tsx`), run **`npm run privacy:stamp`** and
commit the result: it sets the "Last updated" date to today and refreshes
`src/app/privacy/content.hash`. CI enforces this - `npm run privacy:check` (in `verify.yml`) fails a
build whose privacy **content** changed without the date being stamped. The hash ignores the date
value, so a pure date bump needs no re-stamp; only content edits do.

## Blog posts - lightweight process

Authoring or editing a **blog post** (content under `content/blog/`) is content, not a feature, so
it does **not** follow the full Spectra protocol - no spec, no plan, no persona review. It still
must:

- be spell-checked in **Canadian English** (colour, honour, but -ize: realize, organize, recognize);
- follow the repo writing and formatting rules (`docs/rules/guidelines.md`: no long dashes);
- keep the public-repo rule above (no PII; location no finer than region);
- stay **prose plus the known `<PostImage>` / `<PostVideo>` components only** - an `.mdx` post is
  compiled and executed at build (`next-mdx-remote`), so arbitrary JSX, `<script>`, raw HTML,
  `import`s, or JS expressions are a code-injection surface; the PR approver confirms a post has none;
- ship via a **pull request that is approved before it merges** - never committed straight to `main`.

For a **series** post (e.g. Life Log, with the cover sash), start from
`docs/templates/blog-series-post.mdx` and follow `docs/rules/blog-series.md` (it also covers the
baked-in sash for the announcement email).

This carve-out covers the post content only. The blog **pipeline and tooling** (anything under
`src/`, dependencies, config) is a feature and follows the full Spectra protocol.

## Project content - lightweight process

Authoring or editing a **project** (content under `content/projects/`) is content, not a feature,
so it does **not** follow the full Spectra protocol - no spec, no plan, no persona review. Adding a
project is a new `content/projects/<slug>.mdx` file; a card appears on the next build. A brand-new
raster cover also needs its one-line static import registered in `src/lib/project-images.ts` (the
single pipeline touch, mirroring blog covers in `blog-images.ts`); reusing an existing cover key
needs no code. It still must:

- be spell-checked in **Canadian English** (colour, honour, but -ize: realize, organize, recognize);
- follow the repo writing and formatting rules (`docs/rules/guidelines.md`: no long dashes);
- keep the public-repo rule above (no PII; **location no finer than region** - e.g. name builds
  by feature like "Back Deck", never by town);
- stay **prose plus the known components only** (the body is compiled MDX, a code-injection
  surface, so no arbitrary JSX, `<script>`, raw HTML, `import`s, or JS expressions);
- ship via a **pull request that is approved before it merges** - never committed straight to `main`.

This carve-out covers the project content only. The projects **pipeline and tooling** (anything
under `src/`, dependencies, config) is a feature and follows the full Spectra protocol.

<!-- trellis:start -->
## Trellis conventions

This repo follows **Trellis** - rogueoak's shared rules for AI agents. Read the rules in
`docs/rules/` and follow them on every change:

- **`docs/rules/guidelines.md`** - how to write and ship: ASCII-only text, and code that passes
  tests, lint, and build before it merges.
- **`docs/rules/conventions.md`** - how code itself is written (APIs versioned in the URL path).
- **`docs/rules/language.md`** - the voice for anything public-facing (READMEs, docs, release
  notes, user-facing strings).

Pull updates with `/trellis-update`.
<!-- trellis:end -->

<!-- spectra:start -->
## Spectra protocol

This repo uses **Spectra** - spec-driven development with learning feedback loops.
Read `docs/spectra/protocol.md` and follow it for every change:

- **Trivial** change → implement directly. **Feature** → spec in `docs/specs/` (get
  approval first). **Bug/feedback** → doc in `docs/feedback/`.
- Multi-step work → a plan in `docs/plans/`, built in a worktree, **tested before commit**,
  reviewed by the personas in `docs/spectra/personas/` via PR comments, merged on approval.
- **Before concluding, reflect**: update the relevant `docs/overview/` living docs
  (`project`, `features`, `architecture`, `learnings`).
<!-- spectra:end -->
