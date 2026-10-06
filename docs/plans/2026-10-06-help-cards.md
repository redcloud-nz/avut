# In-app help cards, separate from the full guides

**Date:** 2026-10-06
**Issue:** [#367](https://github.com/redcloud-nz/avut/issues/367)
**Branch:** `feat/help-cards`
**Worktree:** `.claude/worktrees/help-cards`, with its dev server on 3107 (its `.dev-port`).
**DB:** no migration and no schema change.
**Written against:** integration @ cdc0568b

## Goal

The `?help=` sheet shows a short **help card** written for the screen you're on. Its "Open the full guide" link goes to the relevant `/docs` guide page, and to a section of it where one fits. Cards live in a new `content/help/**` collection. They are in-app only, never on the public `/docs` site or in its search. The full guides in `content/docs/**` stay where and how they are.

## Decisions

- **Collection name `helpCards`**, directory `content/help`, include `**/*.mdx`. The generated export is `allHelpCards`. A card's **id** is its path without extension (`admin/personnel`). Unlike docs, there is no `index` collapsing: name files for what they are (`admin/dashboard.mdx`), and the id is the plain path.
- **Frontmatter:**
  - `title` (required): the sheet title.
  - `description` (optional): the sheet subtitle. The sheet falls back to "Key info for this page".
  - `guide` (required): a doc slug with an optional `#anchor`, e.g. `skill-track/sessions#4-record-results`. `""` (the docs home) is not allowed.
  - `keyTerms` (default `[]`): glossary slugs for the `<KeyTerms>` callout, rendered after the card body.
- **Body:** about 150 words, 250 at most. It says what the screen is for, the few things you do there, and any gotcha. No `# Title` heading, since the sheet header shows the title. Card bodies use the same `docsMdxComponents` (so `<Screenshot>` and the synthetic-checks callout work), but cards should rarely need a screenshot.
- **Build-time validation** in the `helpCards` transform, using `ctx.documents(docs)` (raw docs: compute slug and anchors from `_meta.path` and `content`):
  - `guide`'s slug must name an existing doc, or the build throws `content/help/<file>: guide "<slug>" is not a doc`.
  - `guide`'s anchor, if present, must be one of that doc's heading ids, or the build throws, listing the available anchors.
  - The transform stores `section` (the guide doc's section) on the card, for flag-hiding.
  - Recomputing slug, section and anchors from the raw doc is deliberate. `ctx.documents()` is typed as the raw schema, and whether it returns transformed docs depends on collection order. Don't cast to read `doc.anchors`.
  - A transform `throw` is fatal only in `npx content-collections build` (and production builds). Under `npm run dev` the bad card is dropped with a logged error, and the coverage test then fails because its id no longer resolves.
- **Heading ids.** Guide headings have no ids today. Add `rehype-slug` to the MDX options for `docs` and `helpCards` so every rendered heading gets a GitHub-style id. `updates` keeps options without it: several entries render on one page, so heading ids there could collide. The anchor list used for validation is computed with `github-slugger` (the library `rehype-slug` uses) over the doc's markdown headings (`#` to `######`, outside fenced code), in document order with one slugger per doc, so duplicates get `-1`, `-2` exactly as rendered. Add both as dependencies. Task 1 proves the computed list matches the rendered ids for every doc.
- **Visibility:** a card is hidden (404 from the route, "no help" in the sheet) when its `section` is flag-hidden, exactly as docs are. Reuse `hiddenDocsSectionIds` in `src/server/docs.ts`; add `getVisibleHelpCard(id)` there.
- **Wiring:** `<HelpButton id="…">` (prop renamed from `slug`, since it no longer names a doc). It still writes `?help=<id>`. `/docs/help/[...slug]` keeps its path (it is just an endpoint) but serves the card: `{ id, title, description, code, keyTerms, guideHref, syntheticChecksEnabled }`, where `guideHref` is `docsHref(slug)` plus `#anchor`. The sheet renders `code`, then `<KeyTerms>`, then the footer link to `guideHref`, which still opens in a new tab.
- **Guides keep everything they have:** their own `keyTerms`, the `<KeyTerms>` callout between intro and rest, and the `introMdx`/`restMdx` split, which the `/docs` page still uses. Only the help route stops using them. `mdx` (the whole compiled doc) has no remaining reader once the route moves. Check with grep; if so, stop compiling it.
- **Coverage test:** a vitest test reads every `.tsx` under `src/` (`globSync` from `node:fs`), extracts `<HelpButton id="…"` with a regex, and asserts each id is a card. It also fails if a JSX `HelpButton` usage (match `/<HelpButton\s/`, which skips the backticked mentions in comments) has no literal `id="…"`, so ids stay greppable. A second assertion: every card is used by at least one `HelpButton` (no orphans). Card `keyTerms` resolve to glossary entries (extend `src/lib/glossary.test.ts`).
- **Which screens share a card** (decided case by case per the issue; the implementer may merge two of these if the content turns out identical, and must say so in their report):

  | Card id                         | Screens (`HelpButton` call sites)                                                                                  | `guide`                                         |
  | ------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
  | `admin/dashboard`               | `admin/page.tsx`                                                                                                   | `admin`                                         |
  | `admin/personnel`               | personnel list, `person-content.tsx`, `person-history-content.tsx`                                                 | `admin/user-vs-person#person`                   |
  | `admin/users`                   | users list, `user-content.tsx`                                                                                     | `admin/user-vs-person#user`                     |
  | `admin/teams`                   | teams list, `team-content.tsx`, `team-members-list.tsx`, `team-membership-content.tsx`, `team-history-content.tsx` | `admin#whats-here`                              |
  | `admin/invitations`             | `admin/invitations/page.tsx`                                                                                       | `admin#whats-here`                              |
  | `admin/rubbish-bin`             | `admin/rubbish-bin/page.tsx`                                                                                       | `admin#whats-here`                              |
  | `admin/organization`            | `admin/organization/page.tsx`, `--update/page.tsx`, `organization-settings-content.tsx`                            | `admin#whats-here`                              |
  | `skill-track/dashboard`         | `skill-track/page.tsx`                                                                                             | `skill-track`                                   |
  | `skill-track/sessions`          | sessions list                                                                                                      | `skill-track/sessions#1-create-the-session`     |
  | `skill-track/session`           | `session-content.tsx`, `session-checks-content.tsx`, `session-history-content.tsx`                                 | `skill-track/sessions#getting-around-a-session` |
  | `skill-track/session-recording` | `session-by-skill-content.tsx`, `session-by-person-content.tsx`                                                    | `skill-track/sessions#4-record-results`         |
  | `skill-track/session-review`    | `session-review-content.tsx`                                                                                       | `skill-track/sessions#5-review-and-approve`     |
  | `skill-track/checks`            | `skill-track/checks/page.tsx`                                                                                      | `skill-track/checks`                            |
  | `skill-track/catalogue`         | `skill-track/catalogue/page.tsx`                                                                                   | `skill-track/catalogue`                         |
  | `skill-track/reports`           | `skill-track/reports/page.tsx`                                                                                     | `skill-track/reports`                           |
  | `skill-track/report-person`     | `reports/person/page.tsx`                                                                                          | `skill-track/reports#personnel-competency`      |
  | `skill-track/report-team`       | `reports/team/page.tsx`                                                                                            | `skill-track/reports#team-competency`           |
  | `skill-track/report-matrix`     | `reports/matrix/page.tsx`                                                                                          | `skill-track/reports#personnel--skill-matrix`   |
  | `skill-track/report-skill`      | `reports/skill/page.tsx`                                                                                           | `skill-track/reports#skill-coverage`            |
  | `skill-package-builder`         | `skill-package-builder/page.tsx`                                                                                   | `skill-package-builder`                         |
  | `i3`                            | `i3/page.tsx`                                                                                                      | `i3`                                            |
  | `d4h-views`                     | `d4h-views/page.tsx`                                                                                               | `d4h-views`                                     |
  | `notes`                         | `orgs/[slug]/notes/layout.tsx`, `user/notes/layout.tsx`                                                            | `notes`                                         |

  Anchors in this table are the intended targets; the build check is the authority on the exact ids.

- **Card content must match the code.** Write each card from the screen's components and its guide, not from the guide alone. Where the guide is wrong or missing something, the card says what the code does, and the gap goes in the implementer's report (it becomes a #366 item). Don't edit the guides in this branch, apart from Task 1's mechanical change.
- **NZ English, plain words, "Personnel"** (not "people") for the person records, matching the app's labels. Reuse the app's on-screen names for buttons and tabs, in bold.

## Tasks

- [ ] **1. Heading ids on the guides**
  - **Files:** `package.json`, `package-lock.json`, `content-collections.ts`, a new `content-collections/heading-anchors.ts` and `content-collections/heading-anchors.test.ts`.
  - **Do:** add `rehype-slug` and `github-slugger` as dependencies. Add `rehypePlugins: [rehypeSlug]` to `mdxOptions`. Add a `headingAnchors(markdown: string): string[]` helper in `content-collections/heading-anchors.ts`, imported by `content-collections.ts` by relative path. It must not use `@/` imports, which the config bundler doesn't resolve. It implements the Decisions rule. Its test imports it by relative path and reads `allDocs` from the `content-collections` alias, never `content-collections.ts` itself (that pulls in esbuild). Then and store `anchors` on each doc in the `docs` transform. Note on `splitIntro`: intro and rest are compiled separately, so each gets its own slugger and a heading repeated across the split would get the same id on the page. Today no doc repeats a heading; make `headingAnchors` run over the whole document, and add a test that asserts no doc has a duplicate anchor, so the split can't produce colliding ids unnoticed.
  - **Done when:** a test inspects every doc's compiled `introMdx` plus `restMdx` (not `mdx`, which Task 2 may drop) and the heading ids, in esbuild's compiled form `id:"…"`, equal `doc.anchors`; `skill-track/sessions` includes `4-record-results`; `npm run check` passes; `/docs/skill-track/sessions#4-record-results` scrolls to that heading on the dev server.

- [ ] **2. `helpCards` collection, route, sheet and button**
  - **Files:** `content-collections.ts`, `content/help/**` (one placeholder-free card per _current_ help slug, see below), `src/server/docs.ts`, `src/app/(public)/(marketing)/docs/help/[...slug]/route.ts`, `src/components/docs/help-sheet.tsx`, `src/components/docs/help-button.tsx`, every `HelpButton` call site (prop rename only), `src/lib/glossary.test.ts`, a new `src/components/docs/help-cards.test.ts`, the `/docs/[[...slug]]/page.tsx` header comment (it says the MDX is reused by the help dialog; it no longer is).
  - **Do:** define the collection per the Decisions. To keep this commit working end to end, create one card per id in use _today_, keeping today's ids so call sites only change `slug=` to `id=`: `admin`, `skill-track`, `skill-track/sessions`, `skill-track/checks`, `skill-track/catalogue`, `skill-track/reports`, `skill-package-builder`, `i3`, `d4h-views`, `notes`. Their content is a first-pass trim of the guide's opening to card length; Tasks 3 and 4 rewrite them. Add `getVisibleHelpCard`, switch the route and sheet, rename the prop, add the coverage test and the glossary assertion. Drop `mdx` from the docs transform if nothing reads it.
  - **Done when:** `npm run check` passes; the coverage test fails if you change one call site's id to a missing card (try it, then revert); a card with a bad `guide` or anchor makes `npx content-collections build` exit non-zero with the expected message (try both, then revert; never `npm run build`, which migrates the DB); as a smoke check (not a visual checkpoint), the sheet on `/orgs/<slug>/skill-track/checks` shows the card and its link opens `/docs/skill-track/checks`.

- [ ] **3. Admin cards**
  - **Files:** `content/help/admin/*.mdx` (replace `admin.mdx` with the seven `admin/…` cards in the table), the admin `HelpButton` call sites.
  - **Do:** write the cards from each screen's components (the pages under `src/app/(wrapper)/(authenticated)/orgs/[slug]/admin/` and `src/components/admin/`). Point each call site at its card per the table.
  - **Done when:** `npm run check` passes (the coverage test proves every id resolves and no card is orphaned); each card is within the length limit (`wc -w`).
  - `visual`

- [ ] **4. Skill Track and remaining cards**
  - **Files:** `content/help/skill-track/*.mdx` (replace `skill-track.mdx` with `skill-track/dashboard.mdx`), `content/help/{skill-package-builder,i3,d4h-views,notes}.mdx`, the Skill Track `HelpButton` call sites.
  - **Do:** as Task 3, for the Skill Track rows of the table, and rewrite the four remaining first-pass cards properly. Session pages: read the session header (Approve/Reopen, Recording Options sheet), the entry pages (the "Also checked by" marker, Recent checks dialog), and the review page (summary strip, coverage cards, exclude dialogs) so the cards describe what's there now.
  - **Done when:** as Task 3.
  - `visual`

- [ ] **5. Authoring guide**
  - **Files:** new `content/README.md`, `.claude/skills/avut-doc-screenshots/SKILL.md` (its description mentions the `?help=` sheet showing the docs).
  - **Do:** `content/README.md` explains the three collections (`docs`, `help`, `updates`, linking to `content/updates/README.md` for the last), the card/guide split and when to write which, the card frontmatter and length limit, when a screen gets its own card versus sharing one, the build checks and the coverage test, and how a user-facing PR updates its card in the same PR while guide changes can go on the milestone docs issue. Keep it short. Fix the screenshots skill where it says the sheet shows the guide: its frontmatter description, and the "same MDX renders in two places" passage (about lines 190–191). A guide screenshot now appears only on `/docs` (768px), a card's only in the sheet (480px). Mention in the README that a bad card is fatal only in `npx content-collections build`.
  - **Done when:** the README exists and is accurate against Tasks 1 to 4; `npm run check` passes.

## Out of scope

- **`/avut-docs`.** That skill exists only on `feat/workflow-tuning` (unmerged). Teaching it about help cards is a follow-up on that branch once this lands; note it in the PR body.
- **Rewriting the guides** and the v0.11 items in #366. Content gaps found while writing cards are reported, not fixed.
- Help for screens that have no `HelpButton` today (user settings, system scope, session entry pages beyond those listed).
- Showing cards anywhere on the public site.
