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
import { assembleStandalone } from "../scripts/lib/standalone.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = process.env.SMOKE_PORT ?? "3010";
const BASE = `http://127.0.0.1:${PORT}`;

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
    // Real intro copy shipped; the old walking-skeleton note must stay gone.
    contains: ["never stopped building"],
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
  // No hasBlur: the projects page is a text-only "coming soon" stub now.
  { path: "/projects", title: "Projects - Matthew Maynes" },
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
    ],
    absent: ["Placeholder", "No posts yet"],
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
      "text-body-lg",
    ],
    absent: ["Placeholder"],
    // The in-body Zombie Horde image is a static-imported next/image with a blur
    // placeholder, so its data-URL must appear (feedback 0005).
    hasBlur: true,
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
    const res = await fetch(BASE + route.path);
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

test("robots, sitemap, and manifest are served", async () => {
  const robots = await fetch(BASE + "/robots.txt");
  assert.equal(robots.status, 200, "expected /robots.txt to 200");
  assert.match(
    await robots.text(),
    /Sitemap:/i,
    "expected robots.txt to reference the sitemap",
  );

  // Every nav route should be listed (5 of them), not just one <loc>. Projects is
  // intentionally kept out of the nav while it is an in-progress stub, so it must
  // not appear in the sitemap either (both derive from `nav`).
  const sitemap = await fetch(BASE + "/sitemap.xml");
  assert.equal(sitemap.status, 200, "expected /sitemap.xml to 200");
  const sitemapXml = await sitemap.text();
  const locs = sitemapXml.match(/<loc>/g) ?? [];
  assert.ok(
    locs.length >= 5,
    `expected sitemap.xml to list all nav routes, saw ${locs.length}`,
  );
  assert.doesNotMatch(
    sitemapXml,
    /\/projects/,
    "expected /projects to be excluded from the sitemap while it is unlisted",
  );
  assert.match(sitemapXml, /matthewmaynes\.com/, "expected canonical host URLs");

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
});

// Exhaustive personal-key guard (spec 0014): NO personal/management PostHog key
// (phx_) may appear in ANY built client asset, not just the home page's chunks.
// Walk every .js under .next/static on disk so a leak in any route's chunk fails.
test("no personal PostHog key (phx_) in any client asset", () => {
  const staticDir = join(root, ".next", "static");
  const stack = [staticDir];
  let scanned = 0;
  let sawConversionEvent = false;
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
      }
    }
  }
  assert.ok(scanned > 0, "expected to scan at least one client .js asset");
  // The core conversion is tracked by explicit PII-free events (autocapture
  // can't see the ph-no-capture form's submit), so the event name must ship in
  // some client chunk (the contact-form island).
  assert.ok(
    sawConversionEvent,
    "expected a client chunk to fire the contact_form_submitted event",
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
