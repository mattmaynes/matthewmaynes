# matthewmaynes.com

Hey, this is the repository for my personal website. It is where my portfolio, resume, blog, and a
way to reach me all live. I built it as a small, fast site and I keep the whole thing here in the
open, so if you are curious how any of it works, poke around.

## What you will find on the site

- **Home, About, and Projects** - a few hand-written pages that introduce me and the things I have
  built.
- **Resume** - my work history, also downloadable as a PDF.
- **Blog** - where I write about building software, the things that break, and what I learn along
  the way. Posts have tags, search, and reading-time estimates, plus an RSS feed if you like to
  follow along that way.
- **Contact** - a simple form to send me a message.

## Running it yourself

If you want to run the site on your own machine:

```bash
npm install
npm run dev
```

Then visit http://localhost:3000. The contact form happily runs without any setup - it just skips
actually sending anything until you give it a mail key.

## How it is built

It is a [Next.js](https://nextjs.org) site written in TypeScript, styled with Tailwind on my own
"Harbor" theme. The blog posts are written in Markdown, and the whole thing builds into a
self-contained package that I run in a Docker container.

A few commands I reach for often:

| Command             | What it does                                    |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Start the local dev server.                     |
| `npm run build`     | Build the production version.                   |
| `npm test`          | Run the test suite.                             |
| `npm run resume:pdf`| Regenerate the downloadable resume PDF.         |

## Running it in Docker

The site ships as a container, so the quickest way to run the production build is:

```bash
docker compose up --build
```

That serves it on http://localhost:3000. The production deployment sits behind a Caddy reverse
proxy, which lives under `deploy/docker/`.

## Where things live

```
content/blog/    my blog posts
src/
  app/           the pages and routes
  components/    the header, footer, blog, and contact form
  lib/           the behind-the-scenes helpers
  styles/        the Harbor theme
public/          photos, blog images, and the resume PDF
deploy/docker/   how it gets deployed
tests/           the test suite
```
