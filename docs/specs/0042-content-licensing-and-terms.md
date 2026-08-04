# 0042 - Content licensing and terms of use

## Problem

The site states no terms at all. Concretely, today:

- there is **no `LICENSE` file** in the repo root (nor a `CONTRIBUTING.md`), which also breaks the
  Trellis rule that every repo ships all three;
- there is **no terms, licence, or copyright page** on the site;
- the footer carries a bare `(c) <year> Matthew Maynes` with no rights statement;
- `/ai-policy` covers how Matthew *uses* AI when writing. It says nothing about how anyone else may
  use his work: zero mentions of reuse, redistribution, training, or licensing;
- `/llms.txt` hands AI crawlers every post with excerpts and attaches no usage terms at all.

Matthew owns the text, photographs, and video on this site and does not grant permission to reuse or
redistribute them. Copyright is automatic, so the absence of a licence already means "all rights
reserved" - but nothing on the site or in the repo *says* so, which leaves a reader guessing and
makes the position unenforceable in practice.

There is also an active hazard. Trellis requires a root `LICENSE`, and the obvious way to satisfy
that is to drop in a permissive one. A bare MIT `LICENSE` at the root nominally covers the whole
repository, **including the family photographs and video committed under `public/`** - the exact
opposite of the intent. Adding the file wrongly is worse than the current gap.

## Outcome

- A root **`LICENSE`** that **splits** the two things this repo holds: the site's **source code** is
  permissively licensed (MIT), while **all written content, photographs, and video are reserved**.
  Satisfies the Trellis requirement without licensing away the media.
- A **`/terms`** page stating plainly: Matthew owns the content; it may not be reused or
  redistributed without permission; the code is separately MIT; and how to ask for permission.
- The same page carries the **views-are-my-own** disclaimer - that everything here is personal and
  does not represent any employer, past or present. The per-post footer line already says a short
  version of this; the terms page is where the full statement lives.
- The **footer** reads `(c) <year> Matthew Maynes. All rights reserved.` and links to `/terms`
  alongside Privacy and AI Policy.
- **`/llms.txt`** carries a `## Usage` section drawing the line the author actually wants: the
  **text may be read, quoted, and cited with attribution and a link**, which is what an answer engine
  needs; the **images and video may not be reproduced, redistributed, or used as training data**.
- `/terms` is in the sitemap and reachable from every page, so both people and crawlers find it.

## Scope

**In**

- **`LICENSE`** (root, new): a two-part file split by **nature, not directory**. Part one, MIT over
  the software *as software* - `src/`, `scripts/`, `tests/`, `.github/`, `deploy/`, config - and
  explicitly NOT over the prose embedded in it (page copy in `src/app/**/page.tsx`, the work history
  in `src/lib/resume.ts`, the bio in `src/lib/site.ts`), which is writing. Part two reserves
  everything else: `content/`, **all** of `public/` (photos, video, illustrations, the resume PDF,
  icons, brand assets), `emails/`, `docs/`, `brand/`, and the root markdown - plus a
  **default-to-reserved catch-all**, so a directory added later cannot fall through an enumeration
  gap into the MIT half. The grant binds "the Software" to that scope and adds a no-implied-grant
  clause.
- **`src/app/terms/page.tsx`** (new): a Server Component in the same shape as `/privacy` and
  `/ai-policy` - page `h1`, prose sections, `metadata` with a canonical. Sections: what is covered,
  what you may do, what you may not do, the code exception, AI and automated use, views are my own,
  and how to ask. Links to `/contact` for permission requests and to the repo `LICENSE` for the code.
- **`src/components/footer.tsx`**: `All rights reserved.` after the copyright, plus a `Terms` link in
  the existing separator list.
- **`src/lib/llms.ts`**: a `## Usage` section in the built markdown, above `## More`, stating the
  text/media split in one short paragraph plus a link to `/terms`.
- **`src/app/sitemap.ts`**: add `/terms` to `EXTRA_ROUTES` (it is footer-linked, not in the top nav,
  same as `/privacy` and `/subscribe`).
- **Tests**: a `/terms` route entry in the smoke table with page-unique copy; a footer assertion for
  `All rights reserved.`; a `buildLlmsTxt` unit assertion for the Usage section; a sitemap assertion.

**Out**

- **`robots.txt` disallow rules for AI training crawlers** (`GPTBot`, `ClaudeBot`, `CCBot`,
  `Google-Extended`). This is a genuine trade-off, not an oversight: spec 0040 added `llms.txt`
  specifically to *invite* answer engines for discovery, and a blanket disallow works against that.
  It is also advisory, not enforcement. Needs a decision on which side of that trade-off to land,
  so it gets its own change.
- **`CONTRIBUTING.md`**, the other missing Trellis root file. Unrelated to licensing; separate.
- **Moving media out of the public repo** (a private data repo or object storage). That is the only
  change that would actually stop GitHub-side redistribution - see Approach - and it is an
  architecture decision with its own spec.
- Any retroactive scrub of media already published or already in git history. Separate, and already
  partly done.
- A cookie/consent or general "terms of service" for using the site as a service. This is a personal
  site; the scope here is content rights and the personal-views disclaimer.

## Approach

**Key decision - split the `LICENSE`, do not pick one.** The repo genuinely holds two different
kinds of thing with two different intents: code Matthew is happy for people to learn from and reuse,
and personal writing and family photographs he is not. A single-licence file cannot express that. So
the file states both halves and names the directories each covers. MIT for the code keeps it
recognisable to anyone reading it; the reservation half is plain English rather than a named licence,
because no standard content licence says "no reuse at all" (CC BY-NC-ND still grants redistribution).
Note that GitHub's licence detection matches on whole-file similarity, so a split file reports as
"Other" rather than MIT - which is the safe outcome here, since reporting MIT would imply the media
is MIT too.

**Key decision - a page, not just a file.** A root `LICENSE` is invisible to a site visitor, and a
footer line is too small to hold the detail. `/terms` is the readable surface; the `LICENSE` is the
machine- and developer-facing one; the footer is the pointer. Each does one job, and they must agree
- if one changes, all three are reviewed.

**Key decision - the `llms.txt` line splits text from media rather than blanket-denying.** The author
wants answer engines to read and cite the writing (that is what `/llms.txt` exists for, spec 0040)
but not to take the photographs. A blanket "do not use" would contradict the file's own purpose;
silence grants nothing but signals nothing either. So the Usage section says exactly that split. It
is a statement of terms, not an access control - `llms.txt` is advisory and a crawler may ignore it.

**What this does NOT achieve, stated plainly.** None of it prevents redistribution:

- **The repo is public on GitHub, and GitHub's Terms of Service grant every user a licence to view
  and fork public repositories** - though only "solely on GitHub as permitted through GitHub's
  functionality", conveying no rights to use the material elsewhere. The photographs and video are
  committed under `public/`, so they are forkable on GitHub regardless of what this `LICENSE` or
  `/terms` says. A notice on the site does not override terms accepted by making the repo public.
  The "solely on GitHub" limit is worth stating precisely: it is the part that protects the author.
- Anything served at `matthewmaynes.com` can be saved by anyone who loads the page.
- `robots.txt` and `llms.txt` are advisory.

The only change that meaningfully narrows this is **moving the media out of the public repo**, which
is deliberately out of scope here and belongs in its own spec. This spec makes the position *stated
and unambiguous*; it does not make it *enforced*. Both matter, and conflating them would oversell
what a licence file does.

**Voice.** `/terms` follows `docs/rules/language.md` and the tone of `/privacy` and `/ai-policy`:
first person, plain, short sentences, no legalese theatre. It should read like Matthew explaining his
position, not like a EULA. Canadian English throughout ("licence" as the noun; the root file keeps
the conventional `LICENSE` filename, which GitHub keys on).

## Acceptance

- [ ] A root `LICENSE` exists and is a **split** licence: MIT for the code, all-rights-reserved for
      `content/`, `public/images/`, `public/videos/`, `emails/`. Neither half can be read as covering
      the other, and the media half does not grant redistribution.
- [ ] `/terms` returns 200 with its own `<title>` and canonical, states the ownership and no-reuse
      position, the code exception, the AI/automated-use split, and the views-are-my-own disclaimer
      naming employers explicitly. Guarded on page-unique copy, not on shared chrome.
- [ ] The footer reads `All rights reserved.` and links to `/terms` on **every** page, including the
      routes that render the shared footer. The link and the rights phrase each have a failable
      marker.
- [ ] `/llms.txt` contains a `## Usage` section that permits quoting and citing the **text** with
      attribution and forbids reproducing or training on the **images and video**, with a link to
      `/terms`. Covered by a `buildLlmsTxt` unit test (pure, no server) and a route smoke assertion.
- [ ] `/terms` is present in `sitemap.xml`; the top nav is unchanged.
- [ ] No PII: the terms page names no email address, phone, or street address - permission requests
      route through `/contact` (the public-repo rule).
- [ ] `npm run lint`, `npm run build`, and `npm test` pass.
- [ ] Shipped via an approved PR (no straight-to-main), persona-reviewed.
