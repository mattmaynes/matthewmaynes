// Lightweight smoke test: boots the production server and asserts every route
// pattern in the site map renders the RIGHT page (HTTP 200 + its route-unique
// <title> + a rendered <h1> body). We assert the page-unique <title> rather than
// nav/footer text, which appears on every page via the shared layout - otherwise
// a blank or wrong page body would still pass (review feedback 0001). Image-
// bearing routes also assert an inlined blur placeholder so the no-flicker
// treatment can't silently regress (feedback 0005).
// Run via `npm test`. Builds first only if no build is present; CI does a clean
// build, so the stale-artifact risk is limited to manual local re-runs.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { assembleStandalone } from "../scripts/lib/standalone.ts";
import {
  getPublishedPosts,
  getDraftPosts,
  getScheduledPosts,
  getAdjacentPosts,
} from "../src/lib/blog.ts";
import {
  deriveTags,
  tagSlug,
  deriveCategories,
  categorySlug,
  filterByCategory,
} from "../src/lib/blog-view.ts";
import { signSession, COOKIE_NAME } from "../src/lib/preview-auth.ts";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = process.env.SMOKE_PORT ?? "3010";
const BASE = `http://127.0.0.1:${PORT}`;

// The sample draft + scheduled posts are test fixtures kept OUT of live content
// (content/blog) so they never appear on the real site (feedback 0022). Point the
// loader at tests/fixtures/blog via BLOG_FIXTURES_DIR so: (1) the in-process
// getDraftPosts()/getScheduledPosts() lookups below resolve them, (2) `next build`
// (which inherits this env) bakes the fixture previews + OG cards, and (3) the
// spawned server (env: {...process.env}) serves them from the dynamic preview page.
const FIXTURES_DIR = join(root, "tests", "fixtures", "blog");
process.env.BLOG_FIXTURES_DIR ??= FIXTURES_DIR;
// The shared preview password the test server is booted with (see the before hook)
// and the cookie the tests mint from it to reach the gated /blog/drafts area.
const PREVIEW_PASSWORD = "test-secret";

// A request header object carrying a valid preview session cookie (spec 0036), for
// the tests that need to reach the gated /blog/drafts preview area.
async function previewCookie(): Promise<{ cookie: string }> {
  return { cookie: `${COOKIE_NAME}=${await signSession(PREVIEW_PASSWORD)}` };
}

// Locate the standalone `server.js`. Normally it sits at the standalone root,
// but inside a nested `.worktrees/<slug>` checkout Next infers the outer repo as
// the workspace root and emits it at `.next/standalone/.worktrees/<slug>/server.js`
// (the two-lockfile quirk - see overview/learnings). Find it either way, skipping
// the unrelated `server.js` files bundled under node_modules.
function findServerJs(dir) {
  const direct = join(dir, "server.js");
  if (existsSync(direct)) return direct;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isDirectory()) {
        if (e.name === "node_modules") continue;
        stack.push(join(cur, e.name));
      } else if (e.name === "server.js") {
        return join(cur, e.name);
      }
    }
  }
  return null;
}

// `title` is the route-unique <title> text (layout template is "%s - Matthew
// Maynes"; home overrides it). Asserting it proves the correct route rendered.
// `contains` are route-unique body substrings that prove the real content
// rendered (not just <head> on an error shell, and not a reverted placeholder).
// `absent` are substrings that must NOT appear (e.g. the "Placeholder" badge on
// a page that has shipped real content) - see feedback 0001/0006.
// `hasBlur` flags routes that render a next/image with placeholder="blur" - the
// server inlines the blurDataURL as a `data:image/...;base64,` value, so its
// presence proves the no-flicker treatment is wired up (feedback 0005).
const routes = [
  {
    path: "/",
    title: "Matthew Maynes - Engineering Director",
    hasBlur: true,
    // Real intro copy shipped; the old walking-skeleton note must stay gone. The
    // "Around the site" grid includes the Projects card (spec 0031) - its note is
    // route-unique, so it proves the card rendered and reddens if it is removed.
    contains: ["never stopped building", "The things I have built and shipped."],
    absent: ["walking skeleton"],
  },
  {
    path: "/about",
    title: "About - Matthew Maynes",
    hasBlur: true,
    contains: ["never stopped building", "The whole crew."],
    absent: ["Placeholder"],
  },
  // No hasBlur: the resume is text-only (the avatar was dropped for the
  // 2-column print layout). Its real content is asserted in the dedicated
  // "renders the real resume with no contact PII" test above.
  { path: "/resume", title: "Resume - Matthew Maynes" },
  {
    path: "/projects",
    title: "Projects - Matthew Maynes",
    // Cover art ships with blur placeholders now (spec 0031).
    hasBlur: true,
    // The three curated sections must render, with route-unique card titles that
    // prove real projects replaced the old stub (Work -> Tinkering -> Making).
    contains: [">Work</h2>", ">Tinkering</h2>", ">Making</h2>", "Eagle SNAP", "Multi-Level Deck"],
    absent: ["Coming soon"],
  },
  {
    path: "/blog",
    title: "Blog - Matthew Maynes",
    // The seed post must be listed by title AND excerpt, the rendered date
    // (proving formatPostDate's UTC parsing, not a raw ISO string), and the
    // cover thumbnail asset - and the placeholder / empty-state copy must be
    // gone (learnings 0003: tighten the guard in the same PR that ships real
    // content).
    contains: [
      "I Picked the Wrong Elective",
      "There is a version of me who took art class",
      "June 28, 2026",
      "turing-sunrise",
      // Reading-time pill on each listing row (spec 0015).
      "min read",
      // Discovery controls (spec 0012): the search input and the tag filter must
      // render. These are DURABLE - unlike the date-relative "New" badge, which is
      // covered by the deterministic isRecent/newPostSlug unit tests instead so the
      // smoke test does not become a time-bomb (the seed post is dated 2026-06-28).
      "Search posts",
      // The category filter is a chip row (spec 0038, replacing the tag Combobox):
      // the group's aria-label is unique to this control, and the leading "All
      // posts" chip clears the filter. Both are in the SSG HTML (chips are plain
      // buttons, not a portalled popover), so they can actually fail if dropped.
      'aria-label="Filter posts by category"',
      "All posts",
      // The active chip is FILLED (spec 0038 Outcome 2): at build the default "All
      // posts" chip is the active one, so its filled treatment + aria-pressed are in
      // the SSG HTML. Guarding the fill class combo (nothing else on /blog emits it)
      // means dropping the active-state styling reddens, not just relabelling.
      'aria-pressed="true"',
      "border-primary bg-primary text-primary-foreground",
      // A seed post's tag still renders in its listing row's tag pills (tags are
      // unchanged by spec 0038 - kept for keyword search and the /blog/tags
      // archives). Uses the niche, SEO-oriented tag set (content, editable in
      // frontmatter).
      "Career Reflection",
      // RSS subscribe link (spec 0013) must render, pointing at the feed.
      'href="/blog/feed.xml"',
      // Feed autodiscovery <link rel="alternate" type="application/rss+xml">.
      // Its href is absolute (metadataBase), so this mimetype marker - not the
      // root-relative subscribe href above - is what guards the head link.
      'application/rss+xml',
      // Email subscribe block (spec 0018) at the bottom of the listing. These
      // markers are UNIQUE to the subscribe form on this route, so they can
      // actually fail (feedback 0013 / the recurring "assert what the unit
      // uniquely produces" learning): the bare "sm:flex-row" utility is emitted by
      // the shared footer too, so it could NOT catch a dropped form. Instead:
      // - the subtext copy proves the form body rendered (unique string), and
      // - "sm:flex-row sm:items-end" is the form's own row container class combo,
      //   which nothing else on /blog emits, so it guards the responsive layout.
      "Subscribe for updates",
      "No spam; unsubscribe anytime.",
      "sm:flex-row sm:items-end",
      // Optional Name affordance (spec 0018 amendment): its label ships in the
      // SSR HTML even though the field is collapsed until the email is focused, so a
      // dropped Name field reddens this. NOTE: the client-only reveal itself
      // (onFocus -> setExpanded(true) -> animate open) is not SSR-observable, so no
      // smoke marker covers that live transition - an acknowledged gap (/blog renders
      // the collapsed state; /subscribe renders the revealed state via alwaysShowName).
      "Name (optional)",
      // DEFAULT-collapsed guard (spec 0024): the Name field now ALWAYS carries
      // `sm:flex-1` (it animates via max-width rather than display-toggling), so
      // sm:flex-1 no longer distinguishes the two states. The collapsed wrapper
      // instead carries `sm:max-w-0` (clamped shut) while the revealed wrapper carries
      // `sm:max-w-md`; so `sm:max-w-0` present here proves the field is collapsed by
      // default, and `sm:max-w-md` in `absent` below proves it is NOT revealed. Both
      // are unique to the subscribe form (grep-confirmed).
      "sm:max-w-0",
      // Guard the headline of spec 0024 - that the reveal ANIMATES, not just that it
      // collapses. The transition wiring is static in the className (always emitted,
      // not behind the expanded/collapsed ternary) and grep-unique to the form, so it
      // ships in SSR HTML: a partial revert that keeps the max-w collapse but strips
      // the transition (-> instant jump, the exact defect 0024 fixes) reddens here.
      "transition-all duration-200 ease-out motion-reduce:transition-none",
    ],
    // The sample draft (spec 0034) and sample scheduled post (spec 0035) must NOT
    // appear on the public listing - a regression to getAllPosts(), or dropping the
    // time-aware filter, would list one of them, so both titles redden.
    absent: [
      "Placeholder",
      "No posts yet",
      "sm:max-w-md",
      "This Is a Sample Draft",
      "This Is a Sample Scheduled Post",
    ],
    // No hasBlur: the only image is the pixel-art cover, which is deliberately
    // rendered un-blurred (image-rendering: pixelated), never blur-upscaled. Its
    // presence is asserted via the "turing-sunrise" asset name above instead.
  },
  {
    path: "/blog/i-picked-the-wrong-elective",
    title: "I Picked the Wrong Elective - Blog - Matthew Maynes",
    // A body-unique phrase proves the MDX body actually compiled and rendered;
    // the reading-time pill, byline, disclaimer, and larger-body markers guard
    // the spec-0011 reading-experience chrome so a revert reddens the smoke test.
    // "text-body-lg" guards the body typography bump (acceptance #1) - without it
    // reverting the post body to text-body would keep every other marker green.
    contains: [
      "accidentally designed a metaphor",
      "min read",
      "By Matthew Maynes",
      "views expressed here are my own",
      // The no-comments note at the bottom of the post (an apostrophe-free phrase,
      // since the copy uses &apos; which resolves in the rendered HTML).
      "love to hear your opinion",
      "text-body-lg",
      // Breadcrumb trail (spec 0022): the Canopy Breadcrumb renders a
      // `nav aria-label="breadcrumb"` landmark - unique to this component (the
      // header nav uses "Primary", post-nav uses "More posts"), so its absence
      // reddens if the trail is dropped. The landmark alone only proves the <nav>
      // shell, so also assert the trail's CONTENT: `BreadcrumbPage` (the current
      // crumb) is the only element on the post page that emits `aria-disabled="true"`
      // - so an empty/broken BreadcrumbList reddens too. (NOT `aria-current="page"`:
      // the header's active Blog link emits that on every /blog/* route, so it would
      // be a false guard - review 0022.)
      'aria-label="breadcrumb"',
      'aria-disabled="true"',
      // RSS subscribe link + feed autodiscovery on the post page (spec 0013).
      'href="/blog/feed.xml"',
      'application/rss+xml',
      // Email subscribe block (spec 0018) after the post content. Unit-unique
      // markers, same rationale as the listing (feedback 0013): the subtext copy
      // proves the form rendered, and "sm:flex-row sm:items-end" (the form's own
      // row container) guards the responsive layout - the bare "sm:flex-row"
      // utility is shared by chrome and could not fail.
      "Subscribe for updates",
      "No spam; unsubscribe anytime.",
      "sm:flex-row sm:items-end",
      // Optional Name affordance (spec 0018 amendment): its label ships in the
      // SSR HTML even though the field is collapsed until the email is focused, so a
      // dropped Name field reddens this. The DEFAULT-collapsed state is guarded by
      // `sm:max-w-0` present here and `sm:max-w-md` in `absent` below (spec 0024 -
      // see the /blog entry above).
      "Name (optional)",
      "sm:max-w-0",
    ],
    absent: ["Placeholder", "sm:max-w-md"],
    // The in-body Zombie Horde image is a static-imported next/image with a blur
    // placeholder, so its data-URL must appear (feedback 0005).
    hasBlur: true,
  },
  {
    path: "/privacy",
    title: "Privacy - Matthew Maynes",
    // Body-unique markers prove the real policy rendered (not a blank shell): a
    // phrase from the copy, the two named processors, and the public privacy
    // address (which renders only in this page body - the shared footer link is
    // label-only, so the /resume and /contact no-email guards stay green). No
    // hasBlur: the page is text-only.
    contains: [
      "I do not sell your data",
      "PostHog",
      "Resend",
      "privacy@matthewmaynes.com",
    ],
    absent: ["Placeholder"],
  },
  {
    // The AI transparency page (spec 0030): footer utility like /privacy, text-only.
    path: "/ai-policy",
    // Footer link + <title> read "AI Policy"; the on-page <h1> is warmer.
    title: "AI Policy - Matthew Maynes",
    // Body-unique markers prove the real copy rendered (not a blank shell): the
    // warmer heading and a distinctive phrase from each of the two core sections.
    contains: [
      "How I Use AI",
      "an editor and a sounding board, not an author",
      "AI does not invent them",
    ],
    absent: ["Placeholder"],
  },
  {
    path: "/contact",
    title: "Contact - Matthew Maynes",
    // Assert form-unique copy (the textarea placeholder) AND the social-row
    // heading, so a dropped/broken <ContactForm/> fails even though the social
    // row still renders (learnings 0001: assert what the unit uniquely produces).
    contains: ["Say hello", "Find me elsewhere"],
    absent: ["Placeholder", "coming soon", "does not send anything yet"],
  },
  {
    // The dedicated subscribe landing page (spec 0020).
    path: "/subscribe",
    title: "Subscribe - Matthew Maynes",
    contains: [
      // Page-unique invitation copy proves the real page body rendered (not just
      // <head> on an error shell). A phrase from the promise, so it is distinct
      // from the blog boxes' "No spam; unsubscribe anytime." subtext.
      "I will not send you many emails",
      // The form renders with all three fields inline: `sm:flex-row sm:items-end`
      // is the row container, and `sm:max-w-md` proves the Name field is SHOWN inline
      // (alwaysShowName -> revealed) rather than collapsed - the positive counterpart
      // to the `/blog` `absent: sm:max-w-md` guard (spec 0024; the field animates via
      // max-width now, so `sm:max-w-md` is the revealed marker, not `sm:flex-1`).
      "sm:flex-row sm:items-end",
      "sm:max-w-md",
      "Name (optional)",
      // The "Latest post" block rendered: the section label, the card's reading-time
      // pill ("min read" is unique to the card on this route, and every post has a
      // reading time), the tag chips (spec 0024 - the tag-chip class combo is unique
      // to the card's tags on this route; DURABLE, not pinned to specific tag values),
      // and the link out to the full listing. These are DURABLE - we deliberately do
      // NOT pin the newest post's title/slug, which changes with every new post (the
      // same time-bomb the /blog "New" badge avoids); the ordering that picks the
      // newest post is covered by the sortPostsNewestFirst unit test.
      "Latest post",
      "min read",
      "bg-muted px-3 py-1 text-caption text-secondary",
      "See all posts",
      'href="/blog"',
    ],
    // No heading={false}: the form's own "Subscribe for updates" h2 must be gone
    // here (the page supplies its own H1 + copy), so a regression that re-enabled
    // it would be a duplicate heading. The sample draft is dated to be the NEWEST
    // post, so if /subscribe reverted to getAllPosts() it would surface in the
    // "Latest post" block - its title absent proves the draft is filtered out
    // (spec 0034 acceptance - review: PR #125).
    absent: [
      "Placeholder",
      "Subscribe for updates",
      "This Is a Sample Draft",
      "This Is a Sample Scheduled Post",
    ],
    // No hasBlur assertion: it would only pass while the newest post's cover happens
    // to be non-pixelated (a pixel-art newest cover renders placeholder="empty", no
    // inlined blurDataURL), so it would redden on unrelated content changes. The blur
    // treatment is guarded on the stable image-bearing routes instead (feedback 0005).
  },
  {
    // The link-in-bio landing page (spec 0039): a hand-out URL, out of the top nav
    // but in the sitemap. Funnels a visitor into the blog + mailing list with the
    // social channels one tap away.
    path: "/links",
    title: "Links - Matthew Maynes",
    contains: [
      // Identity header: the title + region line under the name proves the real
      // page body rendered (the bare name is shared nav/footer chrome).
      "Ontario, Canada",
      // Primary link (top of the stack): the "Read the blog" button links the
      // listing. The label is unique to this page on this route.
      "Read the blog",
      'href="/blog"',
      // Social row: keyed on the LinkedIn profile URL, a durable page-real value.
      // The five buttons open in a new tab.
      'href="https://www.linkedin.com/in/matthew-maynes/"',
      // The subscribe ask - the shared form rendered (its heading is on here). The
      // subtext is unique to the form body, so a dropped/broken form reddens this.
      "Subscribe for updates",
      "No spam; unsubscribe anytime.",
      // The Latest-post card (last): its section label + the reading-time pill
      // ("min read" is unique to the card on this route). DURABLE - we do NOT pin
      // the newest post's title/slug (that changes with every post); newest-first
      // ordering is covered by the sortPostsNewestFirst unit test.
      "Latest post",
      "min read",
      // The path back into the rest of the site.
      "Explore the whole site",
    ],
    // The Latest-post card must use the PUBLISHED set: a draft or not-yet-due
    // scheduled sample post must never surface here (spec 0034/0035). The sample
    // draft is dated to be the newest post, so a regression to getAllPosts() would
    // reveal it - its title absent proves the filter holds.
    absent: [
      "Placeholder",
      "This Is a Sample Draft",
      "This Is a Sample Scheduled Post",
    ],
    // The identity header renders the static-imported headshot with a blur
    // placeholder, so its data-URL must appear (feedback 0005). The headshot is a
    // stable, non-pixelated asset, so unlike /subscribe this route can assert blur.
    hasBlur: true,
  },
  {
    // The drafts index (spec 0034): unlinked, noindex, lists unpublished posts and
    // links each row to its /blog/drafts/<slug> page (not the public /blog URL).
    // The sample-draft fixture (tests/fixtures/blog/this-is-a-sample-draft.mdx,
    // injected via BLOG_FIXTURES_DIR and kept OUT of live content) keeps this
    // surface - and the public draft-leak guards below - exercised with a real draft.
    path: "/blog/drafts",
    title: "Drafts - Matthew Maynes",
    // Gated behind the preview login (spec 0036): the crawler sends a valid session
    // cookie so this index still renders and its content assertions hold. The
    // no-cookie redirect is asserted separately in the login-gate test below.
    gated: true,
    contains: [
      "This Is a Sample Draft",
      'href="/blog/drafts/this-is-a-sample-draft"',
      // Deliberately noindex (the robots meta the drafts pages emit).
      "noindex",
      // The preview index now lists scheduled posts too (spec 0035), each with a
      // "Scheduled" marker - the sample scheduled fixture proves both the listing
      // and the marker render (its title reddens if getPreviewPosts regresses to
      // drafts-only, and "Scheduled" reddens if the row marker is dropped).
      "This Is a Sample Scheduled Post",
      'href="/blog/drafts/this-is-a-sample-scheduled-post"',
      "Scheduled",
    ],
    // The empty-state copy must be gone now that previews exist.
    absent: ["Placeholder", "Nothing here right now."],
  },
];

let server;

async function waitForReady(timeoutMs = 60000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(BASE + "/", { redirect: "manual" });
      if (res.status > 0) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("server did not become ready in time");
}

before(async () => {
  const standaloneDir = join(root, ".next", "standalone");
  let serverJs = findServerJs(standaloneDir);
  if (!serverJs) {
    const build = spawnSync("npx", ["next", "build"], {
      cwd: root,
      stdio: "inherit",
      // Bake the fixture previews + their OG cards (BLOG_FIXTURES_DIR is set at the
      // top of this file, so it is inherited here too - explicit for clarity).
      env: { ...process.env, BLOG_FIXTURES_DIR: FIXTURES_DIR },
    });
    if (build.status !== 0) throw new Error("next build failed");
    serverJs = findServerJs(standaloneDir);
    if (!serverJs) throw new Error("standalone server.js not found after build");
  }

  // Assemble the standalone artifact exactly as the Dockerfile does, next to the
  // real server.js, then run it so the test exercises the deployed shape. Shares
  // the assembly helper with the resume PDF generator (review 0007).
  const serverDir = dirname(serverJs);
  assembleStandalone(root, serverDir);

  server = spawn("node", ["server.js"], {
    cwd: serverDir,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT,
      // Force the contact creds empty so the /v1/contact tests below always
      // fail closed (500) at the config check and NEVER send a real email, even
      // if the developer has real values in their shell / .env.local.
      RESEND_API_KEY: "",
      CONTACT_TO_EMAIL: "",
      CONTACT_FROM_EMAIL: "",
      // Same for the Constant Contact creds: the /v1/subscribe guard tests below
      // all return BEFORE the send, and /v1/contact's CTCT record/subscribe step
      // (spec 0032) is guarded on client id + refresh token, so with these empty
      // the suite never calls Constant Contact, even on a developer machine with
      // real values in .env.local.
      CTCT_CLIENT_ID: "",
      CTCT_REFRESH_TOKEN: "",
      CTCT_LIST_ID: "",
      CTCT_WEBSITE_LIST_ID: "",
      // The preview login gate (spec 0036): give the server a known shared
      // password so the tests can mint a valid session cookie and exercise both
      // the gated (no cookie -> redirect) and authed (valid cookie -> 200) paths.
      PREVIEW_PASSWORD: PREVIEW_PASSWORD,
      // Serve the draft/scheduled fixtures (kept out of live content) so the
      // dynamic preview pages resolve them at runtime (feedback 0022).
      BLOG_FIXTURES_DIR: FIXTURES_DIR,
    },
  });
  await waitForReady();
});

after(() => {
  if (server) server.kill("SIGTERM");
});

// The resume PDF is a committed static asset under public/, generated from the
// /resume page (npm run resume:pdf). Assert it is served AND is a real,
// non-trivial PDF - status + content-type derive from the .pdf extension alone,
// so a 0-byte or truncated commit would otherwise pass (review 0007).
test("GET /resume.pdf serves a real, non-trivial PDF", async () => {
  const res = await fetch(BASE + "/resume.pdf");
  assert.equal(res.status, 200, "expected 200 for /resume.pdf");
  assert.equal(
    res.headers.get("content-type"),
    "application/pdf",
    "expected /resume.pdf to be served as application/pdf",
  );
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.ok(
    bytes.subarray(0, 5).toString("latin1") === "%PDF-",
    "expected /resume.pdf to begin with the %PDF- magic bytes",
  );
  assert.ok(
    bytes.byteLength > 10_000,
    `expected /resume.pdf to be non-trivial, got ${bytes.byteLength} bytes`,
  );
  // Page count is the headline outcome of the resume print type size: the font
  // is tuned to fill exactly two Letter pages, and the last experience block is
  // break-inside-avoid, so a future type bump can silently tip it onto a third
  // page. resume:pdf:check only compares a SOURCE hash (a 3-page PDF regenerated
  // + committed passes it), so guard the rendered result here: count the page
  // objects (/Type /Page, not the /Pages tree node) and require exactly two.
  const pageCount = (
    bytes.toString("latin1").match(/\/Type\s*\/Page(?![s])/g) ?? []
  ).length;
  assert.equal(
    pageCount,
    2,
    `expected the committed resume.pdf to be exactly 2 pages, got ${pageCount}`,
  );
});

// The /resume page must show the real resume, not the old PagePlaceholder (which
// shared the same <title> + an <h1>, so the generic assertions below can't tell
// them apart - cf. feedback 0001). Also guard the privacy criterion: no contact
// PII in the HTML, which covers the PDF too since it renders from this page.
test("GET /resume renders the real resume with no contact PII", async () => {
  const html = await (await fetch(BASE + "/resume")).text();
  for (const marker of ["How I Lead", "Experience", "Certifications"]) {
    assert.ok(html.includes(marker), `expected /resume to render "${marker}"`);
  }
  assert.ok(
    !html.includes("Placeholder"),
    "expected /resume to have dropped the PagePlaceholder badge",
  );
  // The Links section lists the personal website alongside LinkedIn/GitHub. Key
  // on an <a> to the bare site URL: canonical/og render the URL too but as
  // <link>/<meta>, and the nav/brand link "/" (relative), so an absolute-bare-URL
  // anchor is unique to the resume Links entry - reverting the link reddens this.
  assert.match(
    html,
    /<a[^>]+href="https:\/\/matthewmaynes\.com"/,
    "expected /resume to link the personal website in the Links section",
  );
  // Privacy: the public page must not leak an email, a phone number, or the
  // postal code from the private resume source (spec 0005).
  assert.doesNotMatch(
    html,
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i,
    "expected /resume to contain no email address",
  );
  assert.doesNotMatch(
    html,
    /\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/,
    "expected /resume to contain no phone number",
  );
  assert.doesNotMatch(
    html,
    /\bK0K\s?3E0\b/i,
    "expected /resume to contain no postal code",
  );
});

for (const route of routes) {
  test(`GET ${route.path} renders the right page`, async () => {
    // A gated route (spec 0036) needs a valid preview session cookie to render;
    // public routes send none.
    const headers = route.gated
      ? { cookie: `${COOKIE_NAME}=${await signSession(PREVIEW_PASSWORD)}` }
      : undefined;
    const res = await fetch(BASE + route.path, headers ? { headers } : undefined);
    assert.equal(res.status, 200, `expected 200 for ${route.path}`);
    const html = await res.text();
    // Route-unique title: proves this exact route's metadata rendered.
    assert.ok(
      html.includes(`<title>${route.title}</title>`),
      `expected ${route.path} to render <title>${route.title}</title>`,
    );
    // Body actually rendered (not just <head> on an error shell).
    assert.match(
      html,
      /<h1[\s>]/,
      `expected ${route.path} to render an <h1>`,
    );
    // Route-unique body content: proves the real page rendered, so a blank body
    // or a reverted placeholder can't pass on the shared <h1> alone.
    for (const needle of route.contains ?? []) {
      assert.ok(
        html.includes(needle),
        `expected ${route.path} body to contain "${needle}"`,
      );
    }
    for (const needle of route.absent ?? []) {
      assert.ok(
        !html.includes(needle),
        `expected ${route.path} body to NOT contain "${needle}"`,
      );
    }
    // Image-bearing routes inline a blur placeholder; its absence means the
    // no-flicker treatment regressed to a bare <Image> (feedback 0005).
    if (route.hasBlur) {
      assert.match(
        html,
        /data:image\/[a-z]+;base64,/,
        `expected ${route.path} to inline a blur placeholder (placeholder="blur")`,
      );
    }
  });
}

// The footer surfaces the /links page (spec 0039) on larger screens only - the
// mobile footer is already crammed. The link + its separator live in a
// `hidden sm:inline` span (present in the SSR HTML, CSS-hidden below `sm`). Assert
// the /links anchor sits inside that class combo so a regression that drops the
// link OR shows it on mobile (drops the `hidden sm:inline` wrapper) reddens. Keyed
// on `/` but the footer is shared, so this guards every page.
test("the footer links /links, shown on desktop only (hidden sm:inline)", async () => {
  const html = await (await fetch(BASE + "/")).text();
  assert.ok(html.includes('href="/links"'), "expected a footer link to /links");
  assert.match(
    html,
    /class="hidden sm:inline"[\s\S]{0,160}href="\/links"/,
    "expected the /links footer link to sit inside a `hidden sm:inline` wrapper (desktop-only)",
  );
});

// Contact endpoint guards (spec 0008). We exercise every path that does NOT send
// email - cross-origin, honeypot, invalid body, wrong method - so the suite needs
// no Resend key and never sends a real message. The happy path (which would send)
// is unit-tested in tests/contact.test.mjs with an injected fetch.
test("POST /v1/contact rejects a cross-origin request (403)", async () => {
  const res = await fetch(BASE + "/v1/contact", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://evil.example" },
    body: JSON.stringify({ name: "A", email: "a@b.co", message: "hi" }),
  });
  assert.equal(res.status, 403, "expected 403 for a cross-origin POST");
});

test("POST /v1/contact silently drops a honeypot hit (200, no send)", async () => {
  const res = await fetch(BASE + "/v1/contact", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({
      name: "A",
      email: "a@b.co",
      message: "hi",
      company: "i am a bot",
    }),
  });
  assert.equal(res.status, 200, "expected 200 for a honeypot hit");
  assert.equal((await res.json()).ok, true, "expected { ok: true } (silent drop)");
});

test("POST /v1/contact rejects an invalid body (400)", async () => {
  const res = await fetch(BASE + "/v1/contact", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ name: "", email: "nope", message: "" }),
  });
  assert.equal(res.status, 400, "expected 400 for an invalid submission");
});

test("GET /v1/contact is not allowed (405)", async () => {
  const res = await fetch(BASE + "/v1/contact", { method: "GET" });
  assert.equal(res.status, 405, "expected 405 for a non-POST method");
});

test("POST /v1/contact rate-limits a burst from one IP (429)", async () => {
  const headers = {
    "content-type": "application/json",
    origin: BASE,
    "x-forwarded-for": "203.0.113.7", // isolate this test's limiter key
  };
  const body = JSON.stringify({
    name: "Ada",
    email: "ada@example.com",
    message: "hello there",
  });
  let last;
  // Limit is 5 per window; the 6th valid submission from one IP is blocked. The
  // earlier ones return 500 (creds forced empty in the before hook), so no email
  // is ever sent while exercising the limiter.
  for (let i = 0; i < 6; i++) {
    last = await fetch(BASE + "/v1/contact", { method: "POST", headers, body });
  }
  assert.equal(last.status, 429, "expected the 6th rapid submission to be rate-limited");
});

test("POST /v1/contact fails closed (500) when unconfigured, without leaking config", async () => {
  const res = await fetch(BASE + "/v1/contact", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: BASE,
      "x-forwarded-for": "203.0.113.8", // distinct key so the 429 test can't taint this
    },
    body: JSON.stringify({
      name: "Ada",
      email: "ada@example.com",
      message: "hello there",
    }),
  });
  assert.equal(res.status, 500, "expected 500 when the RESEND creds are unset");
  const json = await res.json();
  assert.equal(json.ok, false);
  assert.doesNotMatch(
    JSON.stringify(json),
    /RESEND|CONTACT_TO|api[_-]?key/i,
    "the error response must not name the missing config",
  );
});

// Subscribe endpoint guards (spec 0018). Same shape as the contact guards: we
// exercise every path that does NOT call Constant Contact - cross-origin, honeypot,
// invalid body, wrong method, rate limit, and the unconfigured 500 - so the suite
// needs no CTCT creds and never touches the real API. The happy path (which would
// call Constant Contact) is unit-tested in tests/subscribe.test.mjs with an
// injected fetch.
test("POST /v1/subscribe rejects a cross-origin request (403)", async () => {
  const res = await fetch(BASE + "/v1/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://evil.example" },
    body: JSON.stringify({ email: "a@b.co" }),
  });
  assert.equal(res.status, 403, "expected 403 for a cross-origin POST");
});

test("POST /v1/subscribe silently drops a honeypot hit (200, no call)", async () => {
  const res = await fetch(BASE + "/v1/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email: "a@b.co", company: "i am a bot" }),
  });
  assert.equal(res.status, 200, "expected 200 for a honeypot hit");
  assert.equal((await res.json()).ok, true, "expected { ok: true } (silent drop)");
});

test("POST /v1/subscribe rejects an invalid email (400)", async () => {
  const res = await fetch(BASE + "/v1/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify({ email: "nope" }),
  });
  assert.equal(res.status, 400, "expected 400 for an invalid email");
});

test("GET /v1/subscribe is not allowed (405)", async () => {
  const res = await fetch(BASE + "/v1/subscribe", { method: "GET" });
  assert.equal(res.status, 405, "expected 405 for a non-POST method");
});

test("POST /v1/subscribe rate-limits a burst from one IP (429)", async () => {
  const headers = {
    "content-type": "application/json",
    origin: BASE,
    "x-forwarded-for": "203.0.113.9", // isolate this test's limiter key
  };
  const body = JSON.stringify({ email: "reader@example.com" });
  let last;
  // Limit is 5 per window; the 6th valid submission from one IP is blocked. The
  // earlier ones return 500 (creds forced empty in the before hook), so no real
  // Constant Contact call is ever made while exercising the limiter.
  for (let i = 0; i < 6; i++) {
    last = await fetch(BASE + "/v1/subscribe", { method: "POST", headers, body });
  }
  assert.equal(last.status, 429, "expected the 6th rapid submission to be rate-limited");
});

test("POST /v1/subscribe fails closed (500) when unconfigured, without leaking config", async () => {
  const res = await fetch(BASE + "/v1/subscribe", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: BASE,
      "x-forwarded-for": "203.0.113.10", // distinct key so the 429 test can't taint this
    },
    body: JSON.stringify({ email: "reader@example.com" }),
  });
  assert.equal(res.status, 500, "expected 500 when the CTCT creds are unset");
  const json = await res.json();
  assert.equal(json.ok, false);
  assert.doesNotMatch(
    JSON.stringify(json),
    /CTCT|CLIENT_ID|REFRESH|LIST_ID|token/i,
    "the error response must not name the missing config",
  );
});

// Privacy regression guard (spec 0008's hard constraint): the destination address
// must never render into the page. Tolerate the form's example placeholder; flag
// any other email-shaped string, without hard-coding the private address here.
test("GET /contact exposes no contact email beyond the example placeholder", async () => {
  const html = await (await fetch(BASE + "/contact")).text();
  const emails = html.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? [];
  const unexpected = emails.filter((e) => e.toLowerCase() !== "you@example.com");
  assert.deepEqual(
    unexpected,
    [],
    `/contact must leak no real email; found: ${unexpected.join(", ")}`,
  );
  assert.ok(!/@gmail\.com/i.test(html), "no gmail address in /contact HTML");
});

// A share-card/icon URL may be absolute against metadataBase (the production
// host) or root-relative; either way, fetch only its path/query on the local
// test server. Resolving against BASE normalizes both forms.
async function fetchLocal(url) {
  const u = new URL(url, BASE);
  return fetch(BASE + u.pathname + u.search);
}

async function assertIsImage(res, where) {
  assert.equal(res.status, 200, `expected 200 for ${where}`);
  assert.match(
    res.headers.get("content-type") ?? "",
    /^image\//,
    `expected ${where} to be an image`,
  );
}

// SEO + sharing surface (spec 0004). One fetch of the home page <head>, then
// assertions on the social/discovery tags and the routes/assets they reference -
// each asset is actually fetched, so a missing or broken file fails the suite.
test("a project with an external URL links out in a new tab", async () => {
  const html = await (await fetch(BASE + "/projects")).text();
  // Rise links out to Constant Contact, so the whole card is an external anchor.
  // This guards the entire `href` branch of ProjectCard (spec 0031, Outcome 3),
  // which could otherwise silently regress to a plain card and stay green.
  const anchor = html.match(/<a\b[^>]*href="https:\/\/constantcontact\.com"[^>]*>/);
  assert.ok(anchor, "expected an external anchor to https://constantcontact.com on /projects");
  assert.match(anchor[0], /target="_blank"/, "external card should open in a new tab");
  assert.match(
    anchor[0],
    /rel="[^"]*noopener[^"]*noreferrer[^"]*"/,
    "external card must set rel=noopener noreferrer",
  );
  assert.ok(
    html.includes("(opens in a new tab)"),
    "expected the sr-only new-tab hint on the external card",
  );
});

test("a before/after project has an unlinked detail stub with both images", async () => {
  // Back Deck carries a beforeCover, so it gets a stub page showing before + after.
  const html = await (await fetch(BASE + "/projects/back-deck")).text();
  assert.ok(html.includes("Back Deck"), "expected the project title on the detail stub");
  assert.match(html, />Before</, "expected a Before label");
  assert.match(html, />After</, "expected an After label");
  assert.ok(html.includes("back-deck-before"), "expected the before image asset");
  // The stub is intentionally NOT linked from the grid (direct-URL only).
  const grid = await (await fetch(BASE + "/projects")).text();
  assert.ok(
    !grid.includes('href="/projects/back-deck"'),
    "the grid must not link to the detail stub",
  );
});

test("home page exposes the sharing + SEO metadata", async () => {
  const html = await (await fetch(BASE + "/")).text();

  // Favicon link, and the icon it points at actually resolves to an image.
  const iconLink = html.match(/<link[^>]+rel="icon"[^>]*href="([^"]+)"/);
  assert.ok(iconLink, "expected a favicon <link> with an href");
  await assertIsImage(await fetchLocal(iconLink[1]), "the favicon");

  // Open Graph image: present, and it renders (catches font/logo load failures).
  const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
  assert.ok(ogImage, "expected an og:image meta tag");
  assert.match(html, /<meta\s+property="og:title"/, "expected og:title");
  await assertIsImage(await fetchLocal(ogImage[1]), "the og:image");

  // Twitter large card: the card type, plus the image (twitter-image re-export)
  // renders - a broken re-export would silently break the X preview otherwise.
  assert.match(
    html,
    /<meta\s+name="twitter:card"\s+content="summary_large_image"/,
    "expected a summary_large_image twitter card",
  );
  const twImage = html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/);
  assert.ok(twImage, "expected a twitter:image meta tag");
  await assertIsImage(await fetchLocal(twImage[1]), "the twitter:image");

  // JSON-LD: parse it (not just substring-match) and check the identity shape.
  const ld = html.match(
    /<script type="application\/ld\+json">(.*?)<\/script>/s,
  );
  assert.ok(ld, "expected a JSON-LD script block");
  const person = JSON.parse(ld[1]);
  assert.equal(person["@type"], "Person", "expected a Person JSON-LD type");
  assert.equal(
    person.sameAs?.length,
    3,
    "expected sameAs to list the three social profiles",
  );
});

// Home page "Latest post" highlight (spec 0029): the home page surfaces the
// single newest post via the shared PostRow, so a visitor gets a taste of the
// blog and a direct path in. Asserting the "Latest post" heading alone is shared
// section chrome and would pass even if PostRow rendered nothing; instead prove a
// real post-slug link is present on `/` (only PostRow's cover/title links emit a
// `/blog/<slug>` href on the home page - the cards + CTA link to `/blog` with no
// slug) AND that it matches the newest post that `/blog` lists first. Reverting
// the section drops the heading and the slug link, reddening this test.
test("home page highlights the latest post, linking to it", async () => {
  const home = await (await fetch(BASE + "/")).text();
  assert.ok(
    home.includes("Latest post"),
    "expected a 'Latest post' section heading on the home page",
  );

  // The newest post is whatever `/blog` renders first; derive its slug from the
  // listing so this stays correct as new posts are added (no hardcoded title).
  const blog = await (await fetch(BASE + "/blog")).text();
  const firstSlug = blog.match(/href="\/blog\/([a-z0-9-]+)"/)?.[1];
  assert.ok(firstSlug, "expected the /blog listing to link at least one post");
  assert.ok(
    home.includes(`href="/blog/${firstSlug}"`),
    `expected the home page to link the newest post (/blog/${firstSlug})`,
  );

  // Acceptance #1: the hero carries the secondary "Blog" CTA beside the primary
  // "About me". The word "Blog" alone is shared chrome (nav link, the Blog card,
  // the "See all posts" button all say/point to /blog), so key on the hero CTA's
  // unit-unique treatment: a white-on-dark button (`text-base-white`) linking
  // /blog. Only the hero's photo-overlay CTA carries `text-base-white` on a /blog
  // anchor (the card link is `class="group"`, See-all-posts is a light-surface
  // outline, the nav link is `text-text-muted`). Reverting the button drops this.
  const anchors = [...home.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
  assert.ok(
    anchors.some(
      (a) => a.includes('href="/blog"') && a.includes("text-base-white"),
    ),
    "expected a light-on-dark Blog CTA linking /blog in the hero",
  );
});

// The blog post's per-post OG card must actually render (a wrong font/cover path
// yields a blank card even on a green build - learnings 0004). Pull og:image from
// the post's <head> and assert it resolves to a 200 image/png.
test("blog post exposes a per-post og:image that renders as image/png", async () => {
  const html = await (
    await fetch(BASE + "/blog/i-picked-the-wrong-elective")
  ).text();
  const ogImage = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/);
  assert.ok(ogImage, "expected the post to declare an og:image");
  const res = await fetchLocal(ogImage[1]);
  assert.equal(res.status, 200, "expected 200 for the post og:image");
  assert.equal(
    res.headers.get("content-type"),
    "image/png",
    "expected the post og:image to be image/png",
  );
});

// The blog RSS feed (spec 0013) must be served as application/rss+xml and list
// the seed post. Mirrors the og:image fetch/assert style: fetch the path, assert
// the status + content type, and grep the body for a known marker.
test("GET /blog/feed.xml serves an RSS feed listing the seed post", async () => {
  const res = await fetch(BASE + "/blog/feed.xml");
  assert.equal(res.status, 200, "expected 200 for /blog/feed.xml");
  assert.match(
    res.headers.get("content-type") ?? "",
    /^application\/rss\+xml/,
    "expected /blog/feed.xml to be served as application/rss+xml",
  );
  const xml = await res.text();
  assert.match(xml, /<rss/, "expected an RSS 2.0 root element");
  assert.ok(
    xml.includes("I Picked the Wrong Elective"),
    "expected the feed to list the seed post title",
  );
  // A draft must never leak into the public feed (spec 0034).
  const draft = getDraftPosts()[0];
  if (draft) {
    assert.ok(
      !xml.includes(draft.title),
      "the RSS feed must not list a draft post",
    );
  }
  // Nor a not-yet-due scheduled post (spec 0035): the feed builds from the
  // time-aware getPublishedPosts, so a still-scheduled post is absent until its
  // publishAt (the sample fixture is dated far in the future).
  const scheduled = getScheduledPosts()[0];
  if (scheduled) {
    assert.ok(
      !xml.includes(scheduled.title),
      "the RSS feed must not list a not-yet-due scheduled post",
    );
  }
});

// Draft posts (spec 0034): hidden from the public surfaces above, but reachable
// under /blog/drafts/<slug> with a visible marker and noindex. The published and
// draft routes reject each other's slugs, so a post is served from exactly one.
test("a draft is reachable + marked + noindex under /blog/drafts, and the routes 404 across kinds", async () => {
  const draft = getDraftPosts()[0];
  if (!draft) return; // no drafts to exercise
  const published = getPublishedPosts()[0];
  const headers = await previewCookie(); // preview area is gated (spec 0036)

  // A body-only sentence from tests/fixtures/blog/this-is-a-sample-draft.mdx - it
  // is NOT in the title/excerpt, so it renders only when the FULL body renders.
  const BODY_ONLY = "keeps the drafts view working";

  const draftRes = await fetch(BASE + `/blog/drafts/${draft.slug}`, { headers });
  assert.equal(draftRes.status, 200, "expected 200 for the draft page");
  const draftHtml = await draftRes.text();
  assert.ok(draftHtml.includes(draft.title), "expected the draft's title on its page");
  assert.ok(
    draftHtml.includes("Draft preview"),
    "expected the 'Draft' marker on the draft page",
  );
  assert.ok(draftHtml.includes("noindex"), "expected the draft page to be noindex");
  // With a valid session the FULL body renders (not just the teaser chrome, which
  // also carries the title + "Draft preview"). Keys on a body-only sentence so a
  // regression that shows only the teaser to an authed user reddens (spec 0036).
  assert.ok(
    draftHtml.includes(BODY_ONLY),
    "expected the full draft body to render with a valid session",
  );

  // Without a session the body is WITHHELD: the teaser + login prompt render, but
  // the body-only sentence must NOT leak (feedback 0022). This is the failable
  // guard against a future body-leak on the public teaser.
  const teaser = await fetch(BASE + `/blog/drafts/${draft.slug}`);
  assert.equal(teaser.status, 200, "expected the teaser to render (200) without a session");
  const teaserHtml = await teaser.text();
  assert.ok(teaserHtml.includes("Log in to read"), "expected the login prompt on the teaser");
  assert.ok(
    !teaserHtml.includes(BODY_ONLY),
    "the draft body must NOT be served on the public teaser (no session)",
  );

  // The published route refuses a draft slug (the draft lives at /blog/drafts/<slug>).
  const wrongPublished = await fetch(BASE + `/blog/${draft.slug}`);
  assert.equal(wrongPublished.status, 404, "a draft slug must 404 at /blog/<slug>");

  // The draft route refuses a published slug (with a valid session, so the 404 is
  // the route's own not-found, not the gate redirect).
  if (published) {
    const wrongDraft = await fetch(BASE + `/blog/drafts/${published.slug}`, { headers });
    assert.equal(wrongDraft.status, 404, "a published slug must 404 at /blog/drafts/<slug>");
  }
});

// The gated preview index must render FRESH, not cached (feedback 0023): ISR's
// stale-while-revalidate let the author's browser hold a stale listing (a
// published/removed post appearing to linger). force-dynamic sends `no-store`.
test("the gated /blog/drafts index is dynamic (no-store), not stale-while-revalidate", async () => {
  const headers = await previewCookie();
  const res = await fetch(BASE + "/blog/drafts", { headers });
  assert.equal(res.status, 200, "expected 200 for the authenticated drafts index");
  const cc = res.headers.get("cache-control") ?? "";
  assert.ok(cc.includes("no-store"), `expected a no-store index, got: ${cc}`);
  assert.ok(
    !cc.includes("stale-while-revalidate"),
    `the gated index must not be ISR-cached (stale-while-revalidate), got: ${cc}`,
  );
});

// The preview OG route must 404 for a slug that is not a current preview
// (feedback 0023): a removed/nonexistent slug used to render a blank card with a
// 200 (no null guard), so a stale unfurl could show a mismatched image.
test("the preview OG route 404s for a slug that is not a current preview", async () => {
  const res = await fetch(BASE + "/blog/drafts/this-slug-does-not-exist-xyz/opengraph-image");
  assert.equal(res.status, 404, "a nonexistent preview slug's OG route must 404, not 200");
});

// Scheduled posts (spec 0035): a not-yet-due post is hidden from the public
// /blog/<slug> (404) but previewable under /blog/drafts/<slug> with a "Scheduled"
// marker + noindex, exactly like a draft. It flips onto /blog on its own at its
// publishAt (the time-aware flip is covered by the getPublishedPosts unit test;
// this smoke asserts the "before its time" surfaces, using the far-future fixture).
test("a scheduled post is hidden from /blog, previewable + marked + noindex under /blog/drafts", async () => {
  const scheduled = getScheduledPosts()[0];
  if (!scheduled) return; // no scheduled posts to exercise

  // Hidden from the public post URL until its time.
  const publicRes = await fetch(BASE + `/blog/${scheduled.slug}`);
  assert.equal(publicRes.status, 404, "a not-yet-due scheduled post must 404 at /blog/<slug>");

  // Previewable under /blog/drafts (gated, spec 0036) with the Scheduled marker + noindex.
  const previewRes = await fetch(BASE + `/blog/drafts/${scheduled.slug}`, {
    headers: await previewCookie(),
  });
  assert.equal(previewRes.status, 200, "expected 200 for the scheduled preview page");
  const previewHtml = await previewRes.text();
  assert.ok(previewHtml.includes(scheduled.title), "expected the scheduled post's title on its preview");
  assert.ok(
    previewHtml.includes("Scheduled for"),
    "expected the 'Scheduled for ...' marker on the scheduled preview",
  );
  assert.ok(previewHtml.includes("noindex"), "expected the scheduled preview to be noindex");

  // The published OG-card route must ALSO hide a not-yet-due scheduled post: its
  // real card (title/cover) must not be fetchable at /blog/<slug>/opengraph-image
  // before publishAt, matching the page 404 (spec 0035, "never early"; the card
  // lives under /blog/drafts/<slug>/opengraph-image until then).
  const ogRes = await fetch(BASE + `/blog/${scheduled.slug}/opengraph-image`);
  assert.equal(
    ogRes.status,
    404,
    "a not-yet-due scheduled post's OG card must 404 at /blog/<slug>/opengraph-image",
  );

  // The home page renders a "Latest post" from getPublishedPosts(), so it must
  // not surface a scheduled post's title before its time either.
  const homeHtml = await (await fetch(BASE + "/")).text();
  assert.ok(
    !homeHtml.includes(scheduled.title),
    "the home latest-post slot must not show a not-yet-due scheduled post",
  );
});

// Preview login gate (spec 0036): the /blog/drafts INDEX is gated - no cookie ->
// redirect to /login; a valid cookie -> 200. A preview PAGE is NOT redirected: it
// serves the post's OG metadata publicly (unfurl) and gates only the body
// (feedback 0022). The OG-image sub-route stays public. No published route is
// ever redirected.
test("the /blog/drafts index is gated, a preview page unfurls but gates its body", async () => {
  // Index: no cookie -> redirect to /login?next=/blog/drafts.
  const noCookie = await fetch(BASE + "/blog/drafts", { redirect: "manual" });
  assert.ok(
    noCookie.status === 307 || noCookie.status === 302,
    `expected a redirect from /blog/drafts without a session, got ${noCookie.status}`,
  );
  assert.match(
    noCookie.headers.get("location") ?? "",
    /\/login\?next=/,
    "expected the redirect to point at /login with a next param",
  );

  // A preview PAGE (unlike the index) is NOT redirected: it serves the post's own
  // OG metadata publicly so links unfurl, and gates only the readable body
  // (feedback 0022). No cookie -> 200 + teaser + login prompt, NOT the full post.
  const preview = getDraftPosts()[0] ?? getScheduledPosts()[0];
  if (preview) {
    const slugNoCookie = await fetch(BASE + `/blog/drafts/${preview.slug}`, {
      redirect: "manual",
    });
    assert.equal(
      slugNoCookie.status,
      200,
      `expected a preview page to render (200) without a session, got ${slugNoCookie.status}`,
    );
    const teaserHtml = await slugNoCookie.text();
    // Unfurl works: the page carries the POST'S own OG title, not the generic site
    // card - so a crawler that only reads the page head gets the draft's preview.
    assert.match(
      teaserHtml,
      new RegExp(`property="og:title"\\s+content="${preview.title}"`),
      "expected the preview page to expose the post's own og:title (unfurl works)",
    );
    assert.ok(
      !teaserHtml.includes("Matthew Maynes - Engineering Director"),
      "the preview must not fall back to the generic site card",
    );
    // Body is gated: the login prompt is shown, and the full post body is NOT.
    assert.ok(
      teaserHtml.includes("Log in to read"),
      "expected the login prompt on a preview page without a session",
    );

    // The preview OG card stays PUBLIC (no cookie) so unfurling still works.
    const og = await fetch(BASE + `/blog/drafts/${preview.slug}/opengraph-image`);
    assert.equal(og.status, 200, "the preview OG card must be public (no login)");
    assert.match(
      og.headers.get("content-type") ?? "",
      /^image\//,
      "expected the preview OG card to be an image",
    );
  }

  // With a valid session cookie, the index renders (200).
  const authed = await fetch(BASE + "/blog/drafts", { headers: await previewCookie() });
  assert.equal(authed.status, 200, "expected /blog/drafts to render with a valid session");

  // A published route is never gated (no cookie -> still 200).
  const published = getPublishedPosts()[0];
  if (published) {
    const pub = await fetch(BASE + `/blog/${published.slug}`, { redirect: "manual" });
    assert.equal(pub.status, 200, "a published post must never be gated");
  }
});

// The login screen renders its password form and is noindex (spec 0036).
test("GET /login renders the password form and is noindex", async () => {
  const res = await fetch(BASE + "/login");
  assert.equal(res.status, 200, "expected 200 for /login");
  const html = await res.text();
  assert.ok(html.includes('name="password"'), "expected a password field on /login");
  assert.ok(
    html.includes('action="/v1/login"'),
    "expected the login form to post to /v1/login",
  );
  assert.ok(html.includes("noindex"), "expected /login to be noindex");
});

// The verify handler POST /v1/login (spec 0036), end to end against the running
// server (booted with PREVIEW_PASSWORD="test-secret"). Same-origin headers so the
// http-guards same-origin check passes (it compares new URL(origin).host to Host,
// which fetch sets to 127.0.0.1:PORT automatically).
test("POST /v1/login mints a session on the right password and refuses the wrong one", async () => {
  const sameOrigin = {
    origin: BASE,
    referer: BASE + "/login",
    "content-type": "application/x-www-form-urlencoded",
  };

  // Correct password -> 303 to /blog/drafts, with a non-empty session cookie set.
  const ok = await fetch(BASE + "/v1/login", {
    method: "POST",
    redirect: "manual",
    headers: sameOrigin,
    body: "password=test-secret&next=%2Fblog%2Fdrafts",
  });
  assert.equal(ok.status, 303, "expected 303 on a correct password");
  // The Location must be RELATIVE ("/blog/drafts"), not an absolute URL built from
  // req.url - behind the proxy that host is the container's 0.0.0.0:3000 bind, which
  // is unreachable from a browser (feedback 0021). An absolute internal-host URL
  // ending in /blog/drafts would slip a `endsWith` check, so assert exact equality.
  assert.equal(
    ok.headers.get("location"),
    "/blog/drafts",
    "expected a correct login to redirect to the RELATIVE /blog/drafts (feedback 0021)",
  );
  const okCookies = ok.headers.getSetCookie().join("; ");
  assert.match(
    okCookies,
    /preview_session=[^;\s]+/,
    "expected a correct login to set a non-empty preview_session cookie",
  );

  // Wrong password -> 303 back to /login with error=1, and NO session minted.
  const bad = await fetch(BASE + "/v1/login", {
    method: "POST",
    redirect: "manual",
    headers: sameOrigin,
    body: "password=nope&next=%2Fblog%2Fdrafts",
  });
  assert.equal(bad.status, 303, "expected 303 on a wrong password");
  const badLocation = bad.headers.get("location") ?? "";
  // Relative Location again (feedback 0021): must start with "/login", not an
  // absolute internal-host URL.
  assert.ok(
    badLocation.startsWith("/login?"),
    "expected a wrong password to return to the RELATIVE /login (feedback 0021)",
  );
  assert.match(badLocation, /error=1/, "expected the login error flag on a wrong password");
  const badCookies = bad.headers.getSetCookie().join("; ");
  assert.ok(
    !/preview_session=[^;\s]+/.test(badCookies),
    "a wrong password must NOT mint a preview_session cookie",
  );
});

// GET /v1/logout (spec 0036) clears the session and redirects to /blog with a
// RELATIVE Location (feedback 0021), and expires the cookie.
test("GET /v1/logout clears the session and redirects to /blog", async () => {
  const res = await fetch(BASE + "/v1/logout", { method: "GET", redirect: "manual" });
  assert.equal(res.status, 303, "expected 303 from /v1/logout");
  assert.equal(
    res.headers.get("location"),
    "/blog",
    "expected logout to redirect to the RELATIVE /blog (feedback 0021)",
  );
  const cookies = res.headers.getSetCookie().join("; ");
  assert.match(cookies, /preview_session=/, "expected logout to set the preview_session cookie");
  assert.match(
    cookies,
    /max-age=0|expires=/i,
    "expected logout to expire the preview_session cookie",
  );
});

// Previous/next post navigation (spec 0021). Derive the expected neighbours from
// the SAME source the page renders from (getAllPosts + getAdjacentPosts), so this
// never becomes a time-bomb that reddens on every new post (the /blog "New" badge
// dodges the same trap). The oldest post always has a Next and no Previous, and the
// newest always has a Previous and no Next (>= 2 posts) - so this covers both the
// single-sided cases and the direction of each tile.
test("a post renders previous/next navigation to its chronological neighbours", async () => {
  const posts = getPublishedPosts();
  if (posts.length < 2) return; // nothing adjacent to link with a single post

  const oldest = posts[posts.length - 1];
  const oldestAdj = getAdjacentPosts(posts, oldest.slug);
  const oldestHtml = await (await fetch(BASE + `/blog/${oldest.slug}`)).text();
  assert.ok(oldestAdj.next, "fixture sanity: the oldest post has a newer neighbour");
  assert.ok(
    oldestHtml.includes("Next post"),
    "expected the oldest post to render a 'Next post' tile",
  );
  assert.ok(
    oldestHtml.includes(`href="/blog/${oldestAdj.next.slug}"`),
    `expected the Next tile to link to /blog/${oldestAdj.next.slug}`,
  );
  assert.equal(oldestAdj.previous, null, "fixture sanity: the oldest post has no previous");
  assert.ok(
    !oldestHtml.includes("Previous post"),
    "the oldest post must not render a Previous tile",
  );
  // Layout guards (acceptance #3). These classes are unique to post-nav.tsx, so
  // they can actually fail: `flex-col-reverse` is the mobile next-first stack, and
  // a lone Next tile must align to the RIGHT edge (`sm:justify-end`) so next stays
  // on the right even when solo. `flex-row-reverse` mirrors the Next tile (text
  // left, arrow right). Reverting any of these would otherwise ship green.
  assert.ok(
    oldestHtml.includes("flex-col-reverse"),
    "expected the mobile next-first stack (flex-col-reverse)",
  );
  assert.ok(
    oldestHtml.includes("sm:justify-end"),
    "expected a lone Next tile to align to the right edge (sm:justify-end)",
  );
  assert.ok(
    oldestHtml.includes("flex-row-reverse"),
    "expected the Next tile to mirror (text left, arrow right: flex-row-reverse)",
  );
  // Metadata badges (spec 0023): the tile shows the neighbour's reading time + tags.
  // Scope to the post-nav <nav> block so a tag word that also appears in the current
  // post's prose can't false-pass; the reading-time "min read" also appears in the
  // current post's own header, so it must be asserted inside the block too.
  const oldestNav =
    oldestHtml.match(/<nav aria-label="More posts"[\s\S]*?<\/nav>/)?.[0] ?? "";
  assert.ok(
    oldestNav.includes("min read"),
    "expected the Next tile to show a reading-time pill",
  );
  assert.ok(oldestAdj.next.tags.length > 0, "fixture sanity: the neighbour has tags");
  for (const tag of oldestAdj.next.tags) {
    assert.ok(
      oldestNav.includes(tag),
      `expected the Next tile to show the neighbour tag "${tag}"`,
    );
  }
  // The Next tile's badge row right-aligns (matching its right-aligned title): the
  // contiguous `gap-1.5 justify-end` is unique to the Next badge row (the Previous
  // badge row omits justify-end; the container's `sm:justify-end` is a different
  // substring), so reverting the badge-row alignment reddens here (tester nit).
  assert.ok(
    oldestNav.includes("gap-1.5 justify-end"),
    "expected the Next tile's badge row to right-align (gap-1.5 justify-end)",
  );

  const newest = posts[0];
  const newestAdj = getAdjacentPosts(posts, newest.slug);
  const newestHtml = await (await fetch(BASE + `/blog/${newest.slug}`)).text();
  assert.ok(newestAdj.previous, "fixture sanity: the newest post has an older neighbour");
  assert.ok(
    newestHtml.includes("Previous post"),
    "expected the newest post to render a 'Previous post' tile",
  );
  assert.ok(
    newestHtml.includes(`href="/blog/${newestAdj.previous.slug}"`),
    `expected the Previous tile to link to /blog/${newestAdj.previous.slug}`,
  );
  assert.equal(newestAdj.next, null, "fixture sanity: the newest post has no next");
  assert.ok(
    !newestHtml.includes("Next post"),
    "the newest post must not render a Next tile",
  );
  // A lone Previous tile must align to the LEFT edge (sm:justify-start) so previous
  // stays on the left even when solo - the mirror of the oldest-post guard above.
  assert.ok(
    newestHtml.includes("sm:justify-start"),
    "expected a lone Previous tile to align to the left edge (sm:justify-start)",
  );
  // And its badge row stays LEFT-aligned (no justify-end), the mirror of the Next
  // tile's right-aligned badges above.
  const newestNav =
    newestHtml.match(/<nav aria-label="More posts"[\s\S]*?<\/nav>/)?.[0] ?? "";
  assert.ok(
    !newestNav.includes("gap-1.5 justify-end"),
    "expected the Previous tile's badge row to stay left-aligned",
  );
});

// Tag archive pages (spec 0027): a real, indexable page per tag. Derive the tag
// and its slug from the SAME source the route renders from (getAllPosts +
// deriveTags + tagSlug), so this never time-bombs as posts/tags change.
test("a tag archive lists its posts with a route-unique title; unknown tag 404s", async () => {
  const posts = getPublishedPosts();
  const tags = deriveTags(posts);
  assert.ok(tags.length > 0, "fixture sanity: at least one tag exists");
  const tag = tags[0];
  const slug = tagSlug(tag);

  const res = await fetch(BASE + `/blog/tags/${slug}`);
  assert.equal(res.status, 200, `expected 200 for /blog/tags/${slug}`);
  const html = await res.text();

  // Route-unique title marker ("Posts tagged" appears on no other route) plus the
  // site title suffix - a real <title>, not just the H1, proves generateMetadata ran.
  assert.ok(
    html.includes("Posts tagged") && html.includes("- Blog - Matthew Maynes"),
    "expected the tag page's route-unique <title>",
  );
  // The list actually rendered: a post carrying this tag appears by title.
  const withTag = posts.find((p) => p.tags.includes(tag));
  assert.ok(withTag, "fixture sanity: some post carries the first tag");
  assert.ok(
    html.includes(withTag.title),
    `expected the "${tag}" archive to list "${withTag.title}"`,
  );

  // The archive renders a subscribe form (spec 0027 wires source="blog_tag"); its
  // unique subtext proves the form is on this surface, so dropping it reddens.
  assert.ok(
    html.includes("New posts in your inbox"),
    "expected the tag page to render the subscribe form",
  );

  // Acceptance #4: the post-page tag pills LINK to their archive. Guarded here
  // because reverting the three pills to inert <li> would otherwise ship green
  // (the recurring "a behaviour change needs a guard that can fail" lesson,
  // learnings 0005/0009). Fetch a post carrying this tag and assert the link.
  const postHtml = await (await fetch(BASE + `/blog/${withTag.slug}`)).text();
  assert.ok(
    postHtml.includes(`href="/blog/tags/${slug}"`),
    `expected "${withTag.slug}" to link its "${tag}" pill to /blog/tags/${slug}`,
  );

  // If any tag carries 2+ posts, its archive lists them newest-first (the page
  // renders filterPosts over the newest-first getAllPosts, which preserves
  // order). A no-op while every tag has one post, but it activates as the blog
  // grows; the pure ordering itself is covered by the blog-view unit tests.
  const multiTag = tags.find(
    (t) => posts.filter((p) => p.tags.includes(t)).length >= 2,
  );
  if (multiTag) {
    const multiHtml = await (
      await fetch(BASE + `/blog/tags/${tagSlug(multiTag)}`)
    ).text();
    const inTag = posts.filter((p) => p.tags.includes(multiTag)); // newest-first
    const positions = inTag.map((p) => multiHtml.indexOf(p.title));
    for (let i = 1; i < positions.length; i++) {
      assert.ok(
        positions[i - 1] >= 0 && positions[i - 1] < positions[i],
        `expected "${multiTag}" archive newest-first: "${inTag[i - 1].title}" before "${inTag[i].title}"`,
      );
    }
  }

  // An unknown tag slug is a clean 404 (dynamicParams=false), never a blank render.
  const missing = await fetch(BASE + "/blog/tags/definitely-not-a-real-tag");
  assert.equal(missing.status, 404, "expected 404 for an unknown tag slug");
});

// Category archive pages (spec 0038): a real, indexable page per category, and the
// category badge on a post links to it. Derive the category and slug from the SAME
// source the route renders from (getPublishedPosts + deriveCategories + categorySlug),
// so this never time-bombs as posts/categories change.
test("a category archive lists its posts with a route-unique title; badge links to it; unknown 404s", async () => {
  const posts = getPublishedPosts();
  const categories = deriveCategories(posts);
  assert.ok(categories.length > 0, "fixture sanity: at least one category exists");
  const category = categories[0];
  const slug = categorySlug(category);

  const res = await fetch(BASE + `/blog/categories/${slug}`);
  assert.equal(res.status, 200, `expected 200 for /blog/categories/${slug}`);
  const html = await res.text();

  // Route-unique title marker ("Posts in" appears on no other route) plus the site
  // title suffix - a real <title>, not just the H1, proves generateMetadata ran.
  // Assert the stable prefix, not the quoted category (a <title> may escape the
  // quotes), mirroring the tag-archive test's "Posts tagged" check.
  assert.ok(
    html.includes("Posts in ") && html.includes("- Blog - Matthew Maynes"),
    "expected the category page's route-unique <title>",
  );

  // The list actually rendered: a post in this category appears by title.
  const inCategory = posts.find((p) => p.category === category);
  assert.ok(inCategory, "fixture sanity: some post is in the first category");
  assert.ok(
    html.includes(inCategory.title),
    `expected the "${category}" archive to list "${inCategory.title}"`,
  );

  // The category badge on a post LINKS to its archive (spec 0038): reverting the
  // badge to inert text would otherwise ship green (the recurring "a behaviour
  // change needs a guard that can fail" lesson). Fetch a post in this category and
  // assert the link - it rides on both the post row and the post header.
  const postHtml = await (await fetch(BASE + `/blog/${inCategory.slug}`)).text();
  assert.ok(
    postHtml.includes(`href="/blog/categories/${slug}"`),
    `expected "${inCategory.slug}" to link its "${category}" badge to /blog/categories/${slug}`,
  );

  // If any category carries 2+ posts, its archive lists them newest-first (the page
  // renders filterByCategory over the newest-first getPublishedPosts, which
  // preserves order). The pure ordering itself is covered by the blog-view tests.
  const multi = categories.find(
    (c) => filterByCategory(posts, c, "").length >= 2,
  );
  if (multi) {
    const multiHtml = await (
      await fetch(BASE + `/blog/categories/${categorySlug(multi)}`)
    ).text();
    const inMulti = filterByCategory(posts, multi, ""); // newest-first
    const positions = inMulti.map((p) => multiHtml.indexOf(p.title));
    for (let i = 1; i < positions.length; i++) {
      assert.ok(
        positions[i - 1] >= 0 && positions[i - 1] < positions[i],
        `expected "${multi}" archive newest-first: "${inMulti[i - 1].title}" before "${inMulti[i].title}"`,
      );
    }
  }

  // An unknown category slug is a clean 404 (dynamicParams=false).
  const missingCat = await fetch(BASE + "/blog/categories/definitely-not-a-category");
  assert.equal(missingCat.status, 404, "expected 404 for an unknown category slug");
});

test("robots, sitemap, and manifest are served", async () => {
  const robots = await fetch(BASE + "/robots.txt");
  assert.equal(robots.status, 200, "expected /robots.txt to 200");
  assert.match(
    await robots.text(),
    /Sitemap:/i,
    "expected robots.txt to reference the sitemap",
  );

  // Every nav route should be listed (6 of them), not just one <loc>. Projects is
  // now a shipped nav route (spec 0031), so it must appear in the sitemap too
  // (both derive from `nav`).
  const sitemap = await fetch(BASE + "/sitemap.xml");
  assert.equal(sitemap.status, 200, "expected /sitemap.xml to 200");
  const sitemapXml = await sitemap.text();
  const locs = sitemapXml.match(/<loc>/g) ?? [];
  assert.ok(
    locs.length >= 6,
    `expected sitemap.xml to list all nav routes, saw ${locs.length}`,
  );
  assert.match(
    sitemapXml,
    /\/projects/,
    "expected /projects to be listed in the sitemap now that it ships",
  );
  assert.match(sitemapXml, /matthewmaynes\.com/, "expected canonical host URLs");

  // spec 0027: individual posts and per-tag archives are now crawlable. Assert a
  // real post URL (posts were previously absent from the sitemap entirely) and a
  // tag archive URL are both listed.
  const somePost = getPublishedPosts()[0];
  assert.match(
    sitemapXml,
    new RegExp(`/blog/${somePost.slug}</loc>`),
    "expected each post URL in the sitemap",
  );
  assert.match(
    sitemapXml,
    /\/blog\/tags\/[a-z0-9-]+<\/loc>/,
    "expected per-tag archive URLs in the sitemap",
  );
  // spec 0038: per-category archives are crawlable too. Assert a real category
  // archive URL is listed (dropping the sitemap's categoryEntries would otherwise
  // ship green - acceptance #5).
  assert.match(
    sitemapXml,
    /\/blog\/categories\/[a-z0-9-]+<\/loc>/,
    "expected per-category archive URLs in the sitemap",
  );
  // A draft is absent from the sitemap (spec 0034): both its post URL and the tag
  // archive for any tag UNIQUE to the draft (a tag it shares with a published post
  // legitimately still has a page). A draft-only tag must neither list nor 404-less
  // resolve, or a tag-path revert to getAllPosts() would leak reachable draft-only
  // archives with the post-URL check still green (review: PR #125).
  // A not-yet-due scheduled post is also absent from the sitemap (spec 0035),
  // until its publishAt (the fixture is dated far in the future).
  const scheduledPost = getScheduledPosts()[0];
  if (scheduledPost) {
    assert.doesNotMatch(
      sitemapXml,
      new RegExp(`/blog/${scheduledPost.slug}</loc>`),
      "a not-yet-due scheduled post URL must not appear in the sitemap",
    );
  }
  const draft = getDraftPosts()[0];
  if (draft) {
    assert.doesNotMatch(
      sitemapXml,
      new RegExp(`/blog/${draft.slug}</loc>`),
      "a draft post URL must not appear in the sitemap",
    );
    const publishedTags = new Set(
      deriveTags(getPublishedPosts()).map((t) => t.toLowerCase()),
    );
    for (const t of draft.tags) {
      if (publishedTags.has(t.toLowerCase())) continue; // a shared tag has a real page
      const s = tagSlug(t);
      assert.doesNotMatch(
        sitemapXml,
        new RegExp(`/blog/tags/${s}</loc>`),
        `a draft-only tag archive (${s}) must not be in the sitemap`,
      );
      const tagRes = await fetch(BASE + `/blog/tags/${s}`);
      assert.equal(tagRes.status, 404, `a draft-only tag archive (${s}) must 404`);
    }
  }

  // Manifest is valid JSON and its declared install icons actually resolve.
  const manifest = await fetch(BASE + "/manifest.webmanifest");
  assert.equal(manifest.status, 200, "expected the manifest to 200");
  const json = await manifest.json();
  assert.ok(
    Array.isArray(json.icons) && json.icons.length >= 2,
    "expected the manifest to declare install icons",
  );
  for (const icon of json.icons) {
    await assertIsImage(await fetchLocal(icon.src), `manifest icon ${icon.src}`);
  }
});

// PostHog analytics/replay/errors (spec 0014). Session replay must never record
// what a visitor types into the contact form, so the form carries the
// `ph-no-capture` marker (belt-and-suspenders atop the global maskAllInputs).
// Assert it renders, so a dropped class can't silently start leaking messages.
test("contact form masks its inputs from session replay", async () => {
  const html = await (await fetch(BASE + "/contact")).text();
  assert.match(
    html,
    /class="[^"]*\bph-no-capture\b/,
    "expected the contact <form> to carry ph-no-capture for replay masking",
  );
});

// The client PostHog SDK must ship the PUBLISHABLE project key (phc_) and never
// a personal/management API key (phx_). Collect the app's own JS chunks from the
// home page and grep them: this proves the analytics is wired (the key is
// inlined at build) AND guards the public-repo rule structurally - a personal
// key must never reach the browser bundle.
test("client bundle ships only the publishable PostHog key", async () => {
  const html = await (await fetch(BASE + "/")).text();
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((s) => s.startsWith("/_next/"));
  assert.ok(srcs.length > 0, "expected the home page to load Next JS chunks");

  let bundle = "";
  for (const src of srcs) {
    bundle += await (await fetch(BASE + src)).text();
  }

  assert.ok(
    bundle.includes("phc_"),
    "expected the client bundle to inline the publishable phc_ PostHog key",
  );
  // The primary replay guard (session_recording.maskAllInputs) ships in the
  // provider chunk, which the root layout loads on every route including home -
  // the object key survives minification, so its absence means replay input
  // masking silently regressed.
  assert.ok(
    bundle.includes("maskAllInputs"),
    "expected the client bundle to enable session_recording.maskAllInputs",
  );
  // The local-suppression gate (spec 0016) must be wired into the client bundle,
  // not just unit-tested in isolation: the LOCAL_HOSTS list ships with it, so a
  // dropped guard / inverted condition / tree-shake that re-enables local capture
  // is caught here. `127.0.0.1` is a stable literal from that list.
  assert.ok(
    bundle.includes("127.0.0.1"),
    "expected the client bundle to ship the local-host suppression gate (spec 0016)",
  );
  // The preview password (spec 0036) is a server-only secret: the server boots with
  // PREVIEW_PASSWORD="test-secret", so its absence from the client bundle proves the
  // gate never leaks it (it is read only in the proxy + /v1/login, never a component).
  assert.ok(
    !bundle.includes("test-secret"),
    "PREVIEW_PASSWORD must never reach the client bundle",
  );
});

// Exhaustive personal-key guard (spec 0014): NO personal/management PostHog key
// (phx_) may appear in ANY built client asset, not just the home page's chunks.
// Walk every .js under .next/static on disk so a leak in any route's chunk fails.
test("no personal PostHog key (phx_) in any client asset", () => {
  const staticDir = join(root, ".next", "static");
  const stack = [staticDir];
  let scanned = 0;
  let sawConversionEvent = false;
  let sawSubscribeEvent = false;
  let sawCategoryFilterEvent = false;
  let sawSuccessBadge = false;
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = join(cur, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.name.endsWith(".js")) {
        scanned++;
        const js = readFileSync(full, "utf8");
        assert.doesNotMatch(
          js,
          /phx_[A-Za-z0-9]/,
          `personal (phx_) PostHog key must never reach a client asset: ${full}`,
        );
        if (js.includes("contact_form_submitted")) sawConversionEvent = true;
        if (js.includes("blog_subscribe_submitted")) sawSubscribeEvent = true;
        if (js.includes("blog_category_filtered")) sawCategoryFilterEvent = true;
        if (js.includes("You are on the list")) sawSuccessBadge = true;
      }
    }
  }
  assert.ok(scanned > 0, "expected to scan at least one client .js asset");
  // The core conversions are tracked by explicit PII-free events (autocapture
  // can't see the ph-no-capture forms' submits), so each event name must ship in
  // some client chunk (the contact-form and subscribe-form islands).
  assert.ok(
    sawConversionEvent,
    "expected a client chunk to fire the contact_form_submitted event",
  );
  assert.ok(
    sawSubscribeEvent,
    "expected a client chunk to fire the blog_subscribe_submitted event (spec 0018)",
  );
  // The category chip filter fires a PII-free event so we can see which themes
  // readers narrow to (the raw history.replaceState is invisible to the pageview
  // tracker); its name must ship in the listing island chunk (spec 0038).
  assert.ok(
    sawCategoryFilterEvent,
    "expected a client chunk to fire the blog_category_filtered event (spec 0038)",
  );
  // The success confirmation is client-only (shown after a successful POST, which the
  // smoke server can't reach with creds forced empty), so its copy is not in the SSR
  // HTML. Assert the badge text ships in a client chunk, so a dropped success UI
  // reddens (spec 0025).
  assert.ok(
    sawSuccessBadge,
    "expected a client chunk to carry the subscribe success badge copy (spec 0025)",
  );
});

// The subscribe success badge animates in via the `subscribe-badge-in` keyframe
// (spec 0026). The `.subscribe-badge-enter` class ships with the badge JSX, but the
// keyframe + the reduced-motion opt-out are authored CSS, so guard BOTH halves of the
// spec's acceptance against the built CSS:
//  - the `@keyframes` DECLARATION (not the bare name, which also appears in the class's
//    `animation:` reference - so matching the name alone would survive a dropped
//    keyframe and false-pass; recurring "a cosmetic change needs a guard that can fail"
//    lesson, feedback 0005 / review 0011); and
//  - the `prefers-reduced-motion` rule that sets the class's animation to none (unique
//    substring: the normal rule references the keyframe, only the reduced-motion rule
//    zeroes it), so a removed @media block re-enabling motion reddens.
// Keyframe names / class names are not minifier-renamed.
test("the subscribe badge entrance keyframe + reduced-motion opt-out ship in the built CSS", () => {
  const staticDir = join(root, ".next", "static");
  const stack = [staticDir];
  let sawKeyframe = false;
  let sawReducedMotion = false;
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = join(cur, e.name);
      if (e.isDirectory()) {
        stack.push(full);
      } else if (e.name.endsWith(".css")) {
        const css = readFileSync(full, "utf8");
        if (css.includes("@keyframes subscribe-badge-in")) sawKeyframe = true;
        if (css.includes(".subscribe-badge-enter{animation:none")) sawReducedMotion = true;
      }
    }
  }
  assert.ok(
    sawKeyframe,
    "expected the built CSS to declare the @keyframes subscribe-badge-in animation (spec 0026)",
  );
  assert.ok(
    sawReducedMotion,
    "expected the built CSS to disable the badge animation under prefers-reduced-motion (spec 0026)",
  );
});

// The same-origin /ingest reverse proxy (spec 0014 acceptance) must be
// configured, or all PostHog capture breaks with a green suite. Assert the built
// routes manifest carries the three ingest rewrites to US Cloud - network-free,
// so it can't be masked by an unreachable external host in CI.
test("the /ingest PostHog proxy rewrites are configured", () => {
  const manifest = JSON.parse(
    readFileSync(join(root, ".next", "routes-manifest.json"), "utf8"),
  );
  const rewrites = manifest.rewrites?.afterFiles ?? manifest.rewrites ?? [];
  const dests = rewrites
    .filter((r) => r.source?.startsWith("/ingest"))
    .map((r) => r.destination);
  assert.ok(
    dests.some((d) => d.includes("us.i.posthog.com")),
    "expected an /ingest rewrite to the PostHog US ingest host",
  );
  assert.ok(
    dests.some((d) => d.includes("us-assets.i.posthog.com")),
    "expected an /ingest rewrite to the PostHog US assets host",
  );
});
