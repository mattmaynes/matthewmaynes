# 0003 - About page: the whole person

## Problem

`/about` is still the walking-skeleton placeholder: a `PagePlaceholder` badge, one stub
paragraph, and a "Beyond the Code" image strip with throwaway captions. The brand guide's
"whole person" principle and `features.md` both call for this page to carry the part a resume
cannot - who Matthew is and why, in his own voice. This spec replaces the placeholder with real
content.

Audience (from the developer): the general personal-brand visitor and industry peers - not a
recruiter screen. The resume page already serves the hiring-evaluation job; this page is the
human introduction.

## Outcome

When done, visiting `/about`:

- Shows a real, first-person narrative (no "Placeholder" badge, no stub copy) built from the
  Harbor typography and color tokens.
- Carries one clear throughline: a problem solver who brings people and technology together, a
  leader who still builds, and a customer-obsessed product engineer when he does.
- Reads in the brand voice: direct, first person, grounded, concise, with a little dry wit.
- Keeps a moderate personal section ("Beyond the Code") with the three existing photos and real
  captions - enough to feel human without oversharing.
- Stays responsive (320px up), themed (light/dark), and ASCII-only per Trellis.

## Scope

**In**

- Rewrite `src/app/about/page.tsx`: drop `PagePlaceholder`, render real sections in the shared
  layout using the same section/typography patterns the placeholder used (`max-w-[1200px]`,
  `text-h1/h2`, `text-body`, `text-text` / `text-text-muted`).
- Sections (see *Draft copy*): intro + headshot, "What I do" (problem solver), "A leader who
  still builds" (the build-vs-lead tension + the maker drive), "Titles don't make leaders"
  (leadership belief), and "Beyond the Code" (personal, three photos).
- Real captions for the three personal photos (`family`, `sasha`, `babyMatthew`).
- Update `features.md` status for `/about` from placeholder to live in the reflect step.

**Out** (later / other specs)

- New photography. No Shea photo exists in `public/images/`; the copy references her without
  needing one. Adding one is a follow-up if the developer supplies a scrubbed image.
- The kitchen-cabinets / woodworking build as a full case study - that belongs on the
  **Projects** page (already planned); the about page only references the maker drive in passing.
- Any new shared component or layout change. This is a single-page content build.
- Resume content, contact form, blog - unchanged.

## Approach

- Plain JSX + Tailwind tokens, matching the existing about/resume pages; no new dependencies and
  no Canopy client-boundary components needed (static content only), so the page stays a Server
  Component.
- Reuse the existing `images` metadata from `src/lib/site.ts` and `next/image` exactly as the
  current personal grid does (explicit dimensions, `sizes`, `aspect-[4/3]` crop, `object-top`
  pin on the tall `babyMatthew` portrait).
- ASCII-only copy: spaced hyphens (not em/en dashes), straight quotes, per `docs/rules/`.
- Keep the prose tight. Five short sections beat one long essay, and they each exercise the
  `h2` rhythm the brand guide sets.

## Draft copy

Marked draft - this is the content to approve or redline before the build.

**Intro (beside the headshot)**
Heading: "Hi, I'm Matthew."
> I'm an engineering director who never stopped building. The way I see the job is simple: bring
> the right people and the right technology together around a problem, then find the solution
> that delivers the most value the fastest. I lead from the details and default to action. If I'm
> not living the same problem my team is, I have no business giving them advice about it.

**What I do**
Heading: "What I'm actually good at"
> I get obsessed with problems. I like to understand a system all the way down, then explain it to
> someone who has never read a line of code and turn that conversation into a problem worth
> solving. The wins I chase are the creative ones: a solution nobody expected that ships real
> value quickly. That is true whether I'm building the thing or coaching the team building it -
> I spend a lot of my time helping people find the one or two behavior changes that multiply
> everything else they do.

**A leader who still builds**
Heading: "A leader who still builds"
> Being a director is a constant negotiation with myself: do this one, or coach someone else
> through it? I lean toward staying close to the work, because grounded advice beats theory every
> time. And the obsession does not switch off at the keyboard. When we renovated our last house, I
> decided the kitchen needed new cabinets, so I taught myself to build them - doors and all,
> having never made a cabinet door in my life. That is roughly how I approach most things.

**Leadership belief**
Heading: "Titles don't make leaders"
> I don't put much stock in titles. A leader is anyone who can pull people around a problem and
> find a way through, whether they manage a team or own a single ticket. I'd rather be measured by
> the problems we solved together than by the line on an org chart.

**Beyond the Code** (three photos: family, sasha, babyMatthew)
Heading: "Beyond the Code"
> When I'm not in the code or the org chart, I'm usually outside. My wife Sarah and I live on five
> acres in rural Ontario with our golden doodle, Sasha. We're slowly reforesting one field,
> clearing deadfall from another, and learning the name of every tree on the property (Sarah is
> winning).
>
> In early 2026 we were handed the best problem yet: our daughter, Shea. She has rearranged my
> priorities, my sleep, and my perspective, and the project backlog has never been longer. Worth
> it. The rest of the time you'll find me in the basement gym, on a trail, or losing a board game.

Captions:
- `family` -> "The whole crew, Shea included." (Shea, the newest addition, is in this photo)
- `sasha` -> "Sasha, the best dog ever."
- `babyMatthew` -> "Where it started."

## Acceptance

- [ ] `/about` renders the five real sections above with no "Placeholder" badge and no stub copy.
- [ ] Copy is first person, ASCII-only (no em/en dashes, straight quotes), and matches the
      approved draft (modulo developer redlines).
- [ ] The three personal photos render via `next/image` with the new captions; the tall
      `babyMatthew` portrait keeps its top-pinned crop.
- [ ] Responsive from ~320px up: the intro headshot/text and the photo grid reflow, no horizontal
      overflow.
- [ ] Light and dark themes both read cleanly (tokens only, no hard-coded colors).
- [ ] `npm run lint` and `npm run build` pass; the route smoke test still asserts the `/about`
      `<h1>` and passes.
- [ ] `features.md` `/about` row updated from placeholder to live.

## Notes

- Voice and palette references: `docs/design/brand-guide.md` (Voice & Tone, "whole person").
- Source facts for the narrative live in the local, git-ignored `context/resume.md` plus the
  developer's answers; no PII (phone, email, street address) goes on the page.
