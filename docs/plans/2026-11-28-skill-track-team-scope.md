# Skill Track in team scope

**Date:** 2026-11-28
**Issue:** [#527](https://github.com/redcloud-nz/avut/issues/527) (page decisions in its 2026-11-21 comment), part of the team-scope tracking issue #520. Milestone v0.14. Builds on #524 (team scope root, [plan](2026-11-19-team-scope-root.md)), #525 (team-admin, [plan](2026-11-19-team-admin.md)) and #526 (session team, [plan](2026-11-18-session-team.md)).
**Branch:** `feat/skill-track-team`, worktree `.claude/worktrees/skill-track-team` (dev server on its `.dev-port`, 3108)
**DB:** no migration. `SkillCheckSession.teamId` exists (#526). Shared `avut` is fine.
**Written against:** integration @ bd978299

Skill Track becomes the first org module that also lives in team scope, under `/teams/[slug]/skill-track/…`. The org scope keeps every page, across teams. The team scope gets the team's sessions, checks on the team's people, the four reports fixed to the team, and a read-only catalogue. Assessors stays org-only.

## Decisions

- **Reads go through the org procedures,** with `organization.id`/`team.id` from `requireTeam(slug)`, as every team page does since #524's rework. The team boundary in this PR is a filter, not an access check: a `member` can already read every session through the org scope. It becomes a data boundary with #528. So "this team's only" is enforced by query inputs and page-level `notFound()` (`docs/patterns/route-access-control.md`), not by new procedure checks.
- **No new procedures or mutations,** so no permission, `ctx.logEvent` or `$transaction` changes. Two existing queries gain optional inputs (Task 1). No D4H involvement.
- **Pages in team scope** (from the issue comment):
  - `skill-track` (index), `sessions`, `sessions/[session_id]` and its `by-person`, `by-skill`, `checks`, `history`, `review`
  - `checks`
  - `packages`, `packages/[package_id]`, `packages/[package_id]/groups/[group_id]`, `skills`, `skills/[skill_id]` (read-only)
  - `reports`, `reports/team`, `reports/matrix`, `reports/person`, `reports/skill`
  - Not `assessors`.
- **Registry:** `Modules["skill-track"]` gains `team: { href: (teamSlug) => route("/teams/[slug]/skill-track", { slug: teamSlug }) }` (same segment). It's enabled by the org's `skill-track` key, as `deriveTeamModules` already handles.
- **One way for a shared component to know its scope:** `useOptionalTeam()` in `src/hooks/use-team.tsx` (`useContext(TeamContext)?.team ?? null`, never throws), and `useSkillTrackScope()` in `src/modules/skill-track/lib/use-skill-track-scope.ts` built on it: `{ scope: "team"; team: TeamData }` under `TeamProvider`, otherwise `{ scope: "organization" }` (including outside both scopes, e.g. the `/docs` demos, which render only `check-row` and `record-check-dialog`; keep scope hooks out of those two). Links use `useScopedRoute()`.
- **Report components take the team as a prop,** `team?: { id: TeamId; name: string }`, set by the team page, and read no scope themselves. The org pages pass nothing and stay as they are.
- **Other teams' sessions open in team scope as read-only** (user, 2026-11-28). A session page in team scope renders any session in the org. When `session.teamId !== team.id` (another team's session or an org session), it's **foreign**: nothing on it can be changed from team scope. `useSessionAccess(session)` (`src/modules/skill-track/lib/use-session-access.ts`) returns `{ foreign, locked }`: `foreign` is true only in team scope for another team's or a team-less session, and `locked = isApproved || foreign`.
  - `locked` takes over from the `isApproved` checks that already make an approved session read-only (`session-contents.tsx`, `session-config-dialogs.tsx`, `session-by-person-content.tsx`, `session-by-skill-content.tsx`, `recording-options-sheet.tsx`, `session-review-content.tsx`/`review-checks-dialog.tsx`'s `readOnly`, `session-content.tsx`).
  - `foreign` also hides what an approved session still offers: the session menu's Edit, Delete and Reopen, Approve, and Resolve on conflicts. The History page stays.
  - The recording pages (by person, by skill) render their "nothing to record" state for a foreign session, worded for it, as they do for an approved one (`session-approved-empty.tsx` gains a reason).
  - A foreign session shows a one-line notice under its title: "This session belongs to <team name> (or: the organisation). View only here." with a link to the session in the org scope, shown to users who can open the org scope.
  - This is UI-only, like the rest of the team filter: the org procedures still accept the writes (no team context on the server until #528).
- **Session pages need no team-ownership check.** They mirror the org pages with `requireTeam(slug)` for the ids. `generateMetadata` uses `getTeamBySlug(slug).organization.id` (metadata must not redirect, and `requireTeam` calls `requireSession`).
- **Sessions list:** `skillCheckSessions.listSessions` takes an optional `teamId`; team scope passes it, so the list holds the team's own sessions. Others are reached by links (from checks, a person's history).
- **Creating or editing a session in team scope pins the team.** The create and update dialogs hide the Team field there and send `team.id`. A session can't be moved to another team (or to none) from team scope; that stays an org-scope action.
- **Checks in team scope** are checks whose assessee has a non-`Deleted` membership in the team, any person status (the org Checks page doesn't filter on person status either), from any session or none. `CheckSearchFilters` gains `teamId`; `SkillChecks.search` maps it to `assessee: { teamMemberships: { some: { teamId, status: { not: "Deleted" } } } }`. It isn't a URL search param: the team page passes it to `checkSearchInput`.
  - **Session column:** links every session to its team-scope page (read-only when foreign). `CheckSearchRow.session` gains `teamId`, so the column can mark a foreign session with the owning team's name (or "Organisation") as muted text.
  - **Filters:** the Session filter lists the team's sessions (`listSessions({ teamId })`); the Assessee filter lists `teams.listTeamMemberships` people whose status isn't `Deleted` (matching `listPersonnel`).
  - **Create Check's assessee picker** uses the `sessionTeamAssesseeIds` rule: Active membership, person not `Deleted`.
- **Reports in team scope are fixed to the team.** Team competency, matrix and skill call `getCompetencyMatrix({ teamId: team.id })` (skill adds its `skillId`), with no team picker and no `listTeams` read, and the team's name as the scope label. The skill report's own scope dialog (`skill-scope-dialog.tsx`) hides its team Select. Person report: `getCompetencyMatrix` refuses `teamId` with `personId`, so it keeps `{ personId }`; the picker lists the roster (`listTeamMemberships`, person not `Deleted`), and a `?person=` not on it shows the picker, as a malformed one does now.
- **Catalogue in team scope is read-only:** no subscribe/unsubscribe or other editing controls on packages, groups or skills. Hide them when `useSkillTrackScope().scope === "team"`, not by permission.
- **Sidebar:** `SkillTrack_Sidebar_Menu` serves both scopes through `useScopedRoute`, with Assessors only in org scope. `TEAM_MODULE_SIDEBAR` maps `"skill-track"` to it.
- **Permissions:** the same `<Protect>`s as the org pages, except the reports index in team scope: team, matrix and skill need only `skillCheck: ["view"]` (no `listTeams`), person needs `skillCheck: ["view"]` and `team: ["view"]` (it reads the roster).
- **Links out of Skill Track stay where they go.** `PersonLink`/`TeamLink` on session pages still lead to `/orgs/…/admin/…`, leaving the team scope. Intended for now; team-scope person pages aren't part of this.
- **Breadcrumbs** follow the AGENTS.md trail rules in both scopes, with the hrefs built by `scopedRoute`/`useScopedRoute`.
- **Help cards:** each task that adds a team page adds its route to the card that covers its org twin (`content/README.md`: "in both org and team scope where a screen is used in both"); `help-cards.test.ts` globs page files, so `npm run check` won't catch a miss but CI will. Task 10 updates the card text.
- **Not touched:** the org dashboard's Skill Track stats (`src/components/organization/dashboard-skill-track-stats.tsx`) and the team dashboard.

## Tasks

### Review group A: data layer

- [x] **Task 1: team filters for sessions and checks** (feat(skill-track): filter sessions and checks by team)
  - **Files:** `src/trpc/routers/skill-check-sessions-router.ts` and its test, `src/lib/schemas/skill-check.ts`, `src/server/services/skill-checks.ts` and its test, `src/modules/skill-track/lib/check-search-params.ts` and its test
  - **Do:** Per Decisions. `listSessions` input gains `teamId: TeamId.schema.optional()` (a `where` on it when given). `CheckSearchFilters` gains `teamId: TeamId.schema.optional()`, mapped in `SkillChecks.search` to the roster rule. `CheckSearchRow.session` gains `teamId: TeamId.schema.nullable()`, selected in `search`. `checkSearchInput(organizationId, params, teamId?)` passes `teamId` through. Follow `src/trpc/CLAUDE.md` and `src/server/services/CLAUDE.md`.
  - **Done when:** tests cover `listSessions` with and without `teamId` (another team's and a team-less session left out); `search` with `teamId` returns roster people's checks from a session and standalone, and leaves out a non-member and a `Deleted` membership; rows carry `session.teamId`; `checkSearchInput` with and without `teamId`. `npm run check` passes.
- [x] **Task 2: registry entry, scope hook and module root** (feat(skill-track): register Skill Track in team scope)
  - **Files:** `src/lib/modules.ts`, `src/lib/modules.test.ts` (the "just team-admin" test changes), `src/hooks/use-team.tsx` (`useOptionalTeam`), `src/modules/skill-track/lib/use-skill-track-scope.ts` (new) and its test, `src/app/(wrapper)/(authenticated)/teams/[slug]/skill-track/{layout,loading,page}.tsx` (new), `content/help/skill-track/dashboard.mdx` (`routes`)
  - **Do:** Per Decisions. The layout is the module gate, a copy of the org one; `loading.tsx` copies the org module's (#212 navigation spinner); `page.tsx` is a placeholder that Task 4 replaces. Then `npx next typegen` and the `team` entry. Until Task 5 the team sidebar shows Skill Track as a plain item.
  - **Done when:** `teamModules` on the real registry is `[skill-track, team-admin]` in registry order, with `skill-track` not `alwaysOn`; `moduleHref("skill-track", { scope: "team", slug })` is `/teams/<slug>/skill-track`; the hook test covers team, org and no scope. `npm run check` and the help-cards test pass.

_End of review group A._

### Review group B: team routes, links, sessions

- [x] **Task 3: team-scope session pages** (feat(skill-track): add team-scope session pages)
  - **Files:** `src/modules/skill-track/components/sessions-list.tsx` (optional `teamId` prop), new `page.tsx` files under `src/app/(wrapper)/(authenticated)/teams/[slug]/skill-track/sessions/` mirroring the org ones (list, `[session_id]`, `by-person`, `by-skill`, `checks`, `history`, `review`), the session cards' `routes` in `content/help/skill-track/`
  - **Do:** Each page mirrors its org counterpart (same prefetches, same content component) with `requireTeam` in place of `getOrganizationBySlug`, and `generateMetadata` per Decisions. The list page prefetches `listSessions({ organizationId, teamId })` and passes `teamId` to `sessions-list.tsx`, which adds it to its query in the same commit. Follow `docs/patterns/detail-page-data-fetching.md`. Run `npx next typegen`.
  - **Done when:** each page renders for one of the team's sessions (still fully editable everywhere until Task 7). `npm run check` and the help-cards test pass.
- [x] **Task 4: team-scope checks, catalogue and report pages** (feat(skill-track): add team-scope checks, catalogue and report pages) · `mechanical`
  - **Files:** new `page.tsx` files under `teams/[slug]/skill-track/`: the index (replacing Task 2's placeholder), `checks`, `packages`, `packages/[package_id]`, `packages/[package_id]/groups/[group_id]`, `skills`, `skills/[skill_id]`, `reports`, `reports/{team,matrix,person,skill}`; the matching cards' `routes` in `content/help/skill-track/`
  - **Do:** Mirror the org pages **exactly, prefetches included** (the client queries don't change until Tasks 8–9, and a prefetch that doesn't match what the client reads fails the server render). Index: the org index without Assessors, linking to the team routes. Reports index: the org one's links and `<Protect>`s, pointing to the team routes (Task 9 changes its permissions). Run `npx next typegen`.
  - **Done when:** every page renders in team scope (behaviour inside still org-wide until Tasks 8–9). `npm run check` and the help-cards test pass.
- [ ] **Task 5: scoped links and sidebar** (refactor(skill-track): build Skill Track links for the current scope) · `mechanical`
  - **Files:** every `src/modules/skill-track/components/**` file that links to `/orgs/[slug]/skill-track…` (find them with `grep -rn '"/orgs/\[slug\]/skill-track' src/modules/skill-track`, which also catches calls split over lines, e.g. `session-content.tsx`, `session-menu.tsx`, `session-contents.tsx`, `recording-options-sheet.tsx`), **except** `checks-list.tsx` (Task 8); `src/components/entity-links/{skill-link,skill-group-link,skill-package-link}.tsx`; `src/components/nav/team-sidebar-modules.tsx`; `src/modules/skill-track/components/sidebar-menu.tsx`
  - **Do:** Replace each with `useScopedRoute()` and the matching `/teams/[slug]/skill-track/…` pattern. Links to Assessors stay `route()` and render only in org scope. Sidebar per Decisions.
  - **Done when:** the grep above finds only Assessors links and `checks-list.tsx`; clicking through sessions, skills and reports in team scope stays under `/teams/<slug>/`; the team sidebar shows Skill Track with its sub-pages (no Assessors). `npm run check` passes.

_End of review group B._ No visual checkpoint yet (the pages still behave org-wide).

### Review group C: sessions in team scope

- [ ] **Task 6: sessions in team scope** (feat(skill-track): pin the team on sessions in team scope) · `visual`
  - **Files:** `src/modules/skill-track/components/create-session.tsx`, `update-session.tsx`, `sessions-list.tsx`, `session-team-select.tsx` if it helps
  - **Do:** Per Decisions: in team scope the create and update dialogs hide the Team field and send `team.id`; the list's Team column is hidden there. Follow `docs/patterns/mutation-dialog.md`.
  - **Done when:** creating a session in team scope makes one with this team (its people added, as #526 does), and it shows in the team's list; the update dialog keeps the team; the org scope is unchanged. `npm run check` passes.
- [ ] **Task 7: other teams' sessions are read-only in team scope** (feat(skill-track): show other teams' sessions read-only in team scope) · `visual`
  - **Files:** `src/modules/skill-track/lib/use-session-access.ts` (new) and its test, `session-content.tsx`, `session-contents.tsx`, `session-config-dialogs.tsx`, `session-menu.tsx`, `session-by-person-content.tsx`, `session-by-skill-content.tsx`, `session-approved-empty.tsx`, `recording-options-sheet.tsx`, `session-review-content.tsx`, `session-review-conflicts.tsx`/`resolve-conflict.tsx` as needed, `session-checks-content.tsx` if it has controls
  - **Do:** Per Decisions ("Other teams' sessions open in team scope as read-only"). Swap each `isApproved` lock for `useSessionAccess(session).locked`, and gate the menu, Approve, Reopen and Resolve on `!foreign`. Add the foreign-session notice. Not `mechanical`: it decides what a user can change.
  - **Done when:** in team scope, another team's session and an org session show every page with no way to record, configure, edit, delete, approve, reopen or resolve, with the notice and its org link; this team's own session is unchanged; nothing changes in org scope. The hook test covers org scope, own session, another team's, team-less, and approved. `npm run check` passes.

_End of review group C._ Visual checkpoint: sidebar, sessions list and create, one of the team's sessions, another team's session read-only.

### Review group D: checks, catalogue, reports, docs

- [ ] **Task 8: checks and catalogue in team scope** (feat(skill-track): team-scope checks and a read-only catalogue) · `visual`
  - **Files:** `teams/[slug]/skill-track/checks/page.tsx`, `checks-list.tsx`, `checks-filter-bar.tsx`, `create-check.tsx`, `packages-list.tsx`, `package-content.tsx`, `group-content.tsx`, `skills-list.tsx`, `skill-content.tsx`, `subscribe-package.tsx`/`unsubscribe-package.tsx` as needed
  - **Do:** Per Decisions. The page and `checks-list.tsx` switch to `checkSearchInput(…, team.id)` together. The Session column links per Decisions (a scoped route for every session, with a foreign session's owner as muted text; the org scope is unchanged). The Session filter, Assessee filter and Create Check's picker per Decisions; prefetch what the page's filters read. Catalogue: hide subscribe/unsubscribe and any other editing control in team scope.
  - **Done when:** the team Checks page lists only roster people's checks (session and standalone), links every session (foreign ones marked), and its filters and create dialog offer only the team's sessions and people; the catalogue pages in team scope have no editing controls; the org scope is unchanged. `npm run check` passes.
- [ ] **Task 9: reports fixed to the team** (feat(skill-track): fix Skill Track reports to the team in team scope) · `visual`
  - **Files:** `teams/[slug]/skill-track/reports/{page,team/page,matrix/page,person/page,skill/page}.tsx`, `src/modules/skill-track/components/reports/{team-competency-report,skill-matrix-report,skill-coverage-report,skill-scope-dialog,person-competency-report,person-scope-dialog}.tsx`
  - **Do:** Per Decisions. The team pages pass `team={{ id, name }}` and switch their prefetches in the same commit: team, matrix and skill prefetch `getCompetencyMatrix({ teamId })` (skill with its `skillId`) and drop `listTeams`; person prefetches `listTeamMemberships` and keeps `{ personId }`. With `team` set, the components show no team scope dialog or menu item and read no `listTeams`; `skill-scope-dialog` hides its team Select. The reports index's `<Protect>`s per Decisions.
  - **Done when:** each report in team scope shows the team's roster only, with no team picker; the person picker lists only roster people; the reports index shows team, matrix and skill to a user with `skillCheck: ["view"]` but not `team: ["view"]`; the org reports are unchanged. `npm run check` passes.
- [ ] **Task 10: help card text and developer docs** (docs(skill-track): help cards and docs for team scope) · `mechanical`
  - **Files:** `content/help/skill-track/*.mdx` (text only; routes were added with the pages), `AGENTS.md` (Scope roots: Skill Track as the first org module with a `team` entry, one line)
  - **Do:** Check each card's text still reads true in team scope; where it fits, say once that in a team the page shows that team's sessions, checks or people.
  - **Done when:** `npm run check -- --all` passes (help-cards test included).

_End of review group D._ Visual checkpoint: checks, catalogue, the four reports.

## Docs impact

New: Skill Track in team scope (team's sessions, checks on the team's people, reports fixed to the team, read-only catalogue). The Skill Track guide pages (sessions, checks, reports) likely gain a "in a team" section; new screenshots of the team sidebar with Skill Track and a team report.

## Out of scope

- Narrowing what team-only users can read through org procedures (#528), so the team filter becomes an access boundary.
- D4H and I3 in team scope (#574), D4H Today (#529).
- Moving a session between teams from team scope.
- Refusing writes to a foreign session on the server: team scope has no server-side team context until #528, so the read-only state is UI-only.
- Team-scope person and team pages (`PersonLink`/`TeamLink` keep going to org admin).
- Skill Track stats on the team dashboard.
- Assessor role grants in team scope.

## Parked

## Review notes

- (group A) `use-skill-track-scope.test.tsx`: the `it.each(["org scope", "no scope"])` runs the same unwrapped render twice. Make the org case a real org-only wrapper, or keep one "no TeamProvider" case.
- (group A) `useSkillTrackScope()` returns a new object every render. Hoist a module-level `ORG_SCOPE` constant and `useMemo` the team branch on `team`, since shared components will use it as an effect/memo dependency.
