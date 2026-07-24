# 0039 - Links page - build plan

Source spec: `docs/specs/0039-links-page.md`.

## Steps

1. **Extend the subscribe source union** (`src/components/subscribe-form.tsx`): add `"links_page"`
   to the `source` union so the page can attribute its subscribes (PII-free).

2. **Build the page** (`src/app/links/page.tsx`): Server Component, `export const revalidate = 60`,
   `metadata` (title "Links", inviting description). Render the centred column:
   - identity header (circular `headshot`, name, `title` + `location`, tagline);
   - Latest-post feature card (cover-on-top, `getPublishedPosts()[0]`, `ReadingTimePill`,
     `formatPostDate`), omitted when there are no posts, honouring the `pixelated` cover flag;
   - primary `Read the blog` button to `/blog`;
   - short lead-in + `SubscribeForm source="links_page" alwaysShowName heading={false}`;
   - social row from `site.social` via the `social-icons` wrappers, large icon buttons, new tab.

3. **Footer link** (`src/components/footer.tsx`): add a `Links` entry to the copyright line, wrapped
   with the separator in a `hidden sm:inline` span so it shows from `sm` up only.

4. **Sitemap** (`src/app/sitemap.ts`): add `/links` to `EXTRA_ROUTES`.

5. **Tests** (`tests/smoke.test.ts`):
   - add a `/links` entry to the `routes` array: route-unique `contains` (tagline, "Latest post",
     "Read the blog", a social profile href, the subscribe subtext), `hasBlur: true` (headshot),
     and `absent` guards for the draft/scheduled sample titles (Latest-post must use the published
     set);
   - add a focused test asserting the footer links `/links` with the `hidden sm:inline` combo (so a
     revert that shows it on mobile, or drops it, reddens).

6. **Verify**: `npm run lint` → `npm run build` → `npm test` (from the worktree), green before commit.

7. **Screenshots**: run `next dev` from the worktree; Playwright-capture `/links` at a phone width
   (~390px) and desktop, light + dark, for the PR.

8. **Reflect**: add the route to `docs/overview/features.md` (Pages & routes + Navigation), note the
   footer/sitemap wiring; no new architecture seam or learning expected (pure reuse).

## Verification

- Acceptance checklist in the spec, each mapped to a smoke assertion.
- Manual eyeball of the screenshots (mobile-first layout, tap targets, dark mode).
