# Project

## Mission

**matthewmaynes.com** — a personal website for Matthew Maynes that serves as a portfolio,
resume, and blog. It presents Matthew as a hands-on engineering leader and builder (from shipping
his first iOS app at 18 to leading engineering at Constant Contact) while showing the whole person,
not just the resume.

## Who it's for

- Potential employers, collaborators, and recruiters
- Fellow engineers and technical leaders
- Anyone interested in Matthew's writing or projects

## Goals

1. **Portfolio** — highlight key projects and professional accomplishments.
2. **Resume / About** — a detailed `/resume` (with PDF download) plus an `/about` page that tells
   the fuller, more personal story.
3. **Blog** — write about technical topics, leadership, nature, and life.
4. **Personal brand** — a consistent, professional identity built on the Harbor palette.
5. **Self-hosted** — containerized, runs locally today, deploys to a Linux VM later.

## Non-goals (v1)

- User accounts or authentication.
- A CMS backend — blog posts and project data are authored as files in the repo.
- Blog comments and an analytics dashboard (can come later).

## Hard constraints

- **Privacy.** Matthew's real email, phone, and full address must never appear in any public
  surface: not in tracked files, not in git history, not in the deployed site, not in the
  downloadable PDF. The contact form sends mail **server-side**; the recipient address is never
  exposed to the client. Secrets (SMTP/provider keys) live in environment variables only. See
  `architecture.md`.

## Status

Bootstrapping. The palette ("Harbor", built on `@rogueoak/roots`) is chosen and implemented in
`src/styles/`. The first build (spec `0001`) scaffolds the app with placeholder pages. Visual
assets (photos, headshots) and final copy come later.

## Production

- Domain: `https://matthewmaynes.com` (owned).
- Target host: a self-hosted Linux VM running the container.
