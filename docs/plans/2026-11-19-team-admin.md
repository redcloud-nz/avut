# The `team-admin` module

**Date:** 2026-11-19
**Issue:** [#525](https://github.com/redcloud-nz/avut/issues/525), part of the team-scope tracking issue [#520](https://github.com/redcloud-nz/avut/issues/520) (design: redcloud-nz/avut-ideas#40). Milestone v0.13.
**Branch:** `feat/team-admin`, worktree `.claude/worktrees/team-admin` (dev server on its `.dev-port`, 3107)
**DB:** no migration. Shared `avut` is fine.
**Written against:** integration @ 045d9893 (which includes #524, the team scope root, merged as PR #542).

Adds the first team-only module, `team-admin`, at `/teams/[slug]/admin`. People granted a team can manage it there without going through the org scope: its name, slug and description, its roster, its access grants and its D4H link. The UI reuses Admin → Teams' cards and dialogs, which move into the shared layer so both modules can use them.

## Decisions

- **No new procedures.** After #524's rework, team pages read through the ordinary org procedures with the team's `organizationId` and `teamId` from `requireTeam(slug)`, and the `TeamUser` grant is only the entry gate (`src/server/team-access.ts`). Team admin writes the same way, through the existing `teams.*` and `teamUsers.*` mutations under their existing permissions:
  - details (name, slug, description): `teams.updateTeam`, `team: ["update"]`
  - roster add: `teams.createTeamMembership`, `team: ["update"]`. Roster remove: `teams.deleteTeamMembership`, `team: ["delete"]` (as Admin → Teams)
  - access grants: `teamUsers.listTeamUsers` (`member: ["view"]`), `grantTeamAccess`/`revokeTeamAccess` (`member: ["update"]`)
  - D4H link, sync, unlink: `teams.linkTeamToD4H`/`executeD4HTeamSyncPlan`/`unlinkTeamFromD4H`, `team: ["update"]`

  So no new `ctx.logEvent` or `$transaction` work, and no new D4H-token path (the D4H card already handles a missing token). "Acts only on the team in the URL" holds because every page takes the team's ids from `requireTeam(slug)`. As in #524, the grant isn't a data boundary until #528 narrows org-wide permissions.

- **Pages** (user, 2026-11-19): `/teams/[slug]/admin`, the overview (Details, Access and D4H cards, plus a Members link card), and `/teams/[slug]/admin/members`, the roster table with **New Member** and a **Remove** button on each row. There's no membership detail page and no History page in team scope.
- **Lifecycle stays in org admin.** Archive, restore, delete and recover aren't offered in team scope: the issue lists only roster, access, D4H and name/slug, and archiving or deleting would end the team scope under the person using it.
- **The shared team UI moves to `src/components/teams/`.** A module can't import another module (lint), so everything both modules render leaves `src/modules/org-admin/components/teams/`. The `AdminModule_` prefix becomes `Teams_` (e.g. `Teams_UpdateTeam_Dialog`). `src/components/team/` stays the team scope root's own UI (its dashboard). Org admin's page-level components stay in org-admin (navbars, breadcrumbs, its team menu, the teams list, the history, membership pages and its create/archive/delete/restore/recover dialogs). Moving:
  - `update-team.tsx`, `team-access-card.tsx`, `grant-team-access.tsx`, `revoke-team-access.tsx`, `d4h-link-card.tsx`, `add-team-membership.tsx`, `remove-team-member.tsx`, `membership-source-badge.tsx`, `d4h-member-status-badge.tsx`
  - extracted: `team-details-card.tsx` (the Team Details card out of `team-content.tsx`, with its Edit pencil), `team-members-table.tsx` (the members table out of `team-members-list.tsx`: columns, toolbar, pseudo-query, pagination, with the last column's content supplied by a `rowAction(row)` prop), and the D4H group of `team-menu.tsx`'s menu (Link / Sync / Unlink) as `Teams_D4HMenuGroup`, so both modules' menus share it.
- **Shared components stay scope-agnostic; behaviour comes in through props.** Team admin passes:
  - `linkPeople={false}` (default `true`) on the members table and the Access card: names render as plain text rather than `PersonLink`/`OrgUserLink`, which go to org admin pages that a team-only user won't reach once #528 lands. The same call as #524's dashboard roster.
  - `requireSlug` on `Teams_UpdateTeam_Dialog` (user, 2026-11-19: rename only). In team scope the slug can be changed but not cleared: clearing it would take the team out of team scope and lock out everyone working there, so that stays in Admin → Teams. The rule lives in the schema as `TeamData.formSchema(storedSlug, { requireSlug })`, so it's tested once; the field's description says why. It's a UI rule only: the procedure still accepts a null slug from org admin.
  - `onUpdated(updated)` on the update dialog, `onChanged()` on the D4H card (link, unlink, sync), and `onSelfRevoked()` on the Access card.
- **Keeping team scope fresh after a write.** Team admin pages read the team through `teams.getTeam` (prefetched by the page, read with `useSuspenseQuery`), not `useTeam()`, so the existing mutation effects refresh them as they do in org admin. The layout's snapshot (`TeamProvider`, the window title) comes from `requireTeam` and only updates on `router.refresh()` (see `use-team.tsx`). So:
  - an update that changed the slug → `router.replace(route("/teams/[slug]/admin", { slug: updated.slug }))`. `updateTeam` already revalidates the old and new slugs' cache entries server-side;
  - any other update, and every D4H link, unlink or sync → `router.refresh()`;
  - roster and access changes touch only queries, so the effects cover them (the dashboard's roster reads `teams.listTeamMemberships` too).

  When a callback navigates, the dialog lets it rather than closing itself first, as `remove-team-member.tsx`'s `onRemoved` already does (closing would race `router.push` against nuqs's URL update). **A `router.refresh()` waits for the `?action` clear:** `await setAction(…)` first, then refresh, as `src/modules/skill-track/components/update-session.tsx` does. Otherwise the server render can land with `?action=update` (or `d4h-link`/`d4h-unlink`) still in the URL and reopen the dialog (plan review).

- **Who sees team admin.** Both pages read `teams.getTeam`, which needs `team: ["view"]`. Granted users whose roles lack it (only `i3-editor`, `i3-admin`, `skills-author`) get the team layout's `forbidden.tsx` there, as on org admin's team pages. The sidebar's **Admin** item stays `alwaysOn` like org admin's, but its **Members** sub-item sits inside `<Protect permissions={{ team: ["view"] }}>`. Holders of `team: ["view"]` without write permissions see the pages read-only.
- **Archived or binned people with an Active membership** show in team admin's table and its "N Personnel" count, exactly as in org admin (`teams.listTeamMemberships` drops only Deleted memberships). That is #540, which team admin inherits as-is; note on #540 that it now covers team admin too. The team dashboard's roster already filters them out, so the two can differ until #540 is settled.
- **Round trips per hop.** Each team page calls `requireTeam(slug)` for the ids and roles. On a hard load that's the layout's per-request cached call. But the layout doesn't re-run on client navigation, so each hop between dashboard, admin and members costs one uncached grant query: an indexed `teamUser.findUnique`, run alongside the cached settings and roles. This was deferred to #525 in #524's review notes, and is accepted here (the user decides at plan approval).
- **Revoking your own grant** (user, 2026-11-19: warn, then leave). When the grant being revoked is the signed-in user's, the revoke dialog adds "You'll lose access to this team's space." (in both scopes, since it's true in both). In team scope, `onSelfRevoked` sends the user to `/user` with `router.replace`, so Back doesn't land on the now-404 admin URL. `/user` is reachable by every user. The card works out "is this me" with `useUser()` from `@/client/auth-queries` (`authClient` is lint-banned in `src/components/**`). It calls `onSelfRevoked` instead of closing only when it's the caller's own grant, and closes itself otherwise.
- **Registry.** `TeamModuleId = "team-admin"`. The entry: `id: "team-admin"`, `label: "Admin"`, `icon: WrenchIcon` (as org-admin), `segment: "admin"`, `scope: "team"`, `alwaysOn: true`, `href: (teamSlug) => route("/teams/[slug]/admin", { slug: teamSlug })`. For who sees it, see "Who sees team admin" above.
- **Sidebar.** `TEAM_MODULE_SIDEBAR["team-admin"]` is a `TeamAdmin_Sidebar_Menu` in `src/modules/team-admin/components/sidebar-menu.tsx` with one sub-item, **Members** (behind `<Protect permissions={{ team: ["view"] }}>`), after `org-admin/components/sidebar-menu.tsx`. `team-sidebar-modules.tsx` is already on lint's list of files allowed to import `src/modules/`.
- **Team admin's own menu.** The overview's `Saratoga.Actions` holds a `TeamAdmin_Team_Menu` (`EntityActionMenu`, after `feedback-detail-page-actions-menu`): **Edit** (`?action=update`), then `Teams_D4HMenuGroup` when the D4H integration is on. No History link and no lifecycle actions. The Details card keeps its pencil too.
- **Help card.** A new `content/help/team-admin.mdx` (`guide: admin/teams`, the closest guide until the milestone's team-scope guide exists), wired with `<HelpButton id="team-admin" />` on both pages. `content/help/admin/teams.mdx` is unchanged: org admin's screens don't change.

## Tasks

### Review group A: shared team UI

- [x] **Task 1a: move the shared team UI to `src/components/teams/`** (refactor(teams): move Admin → Teams' cards and dialogs to the shared layer) · `mechanical`
  - **Files:** the nine moved files above (`git mv` from `src/modules/org-admin/components/teams/` to `src/components/teams/`), and their importers: `src/modules/org-admin/components/teams/{team-content,team-members-list,team-menu,team-membership-content,team-membership-menu}.tsx`, `src/modules/org-admin/components/personnel/{team-memberships,person-menu}.tsx`
  - **Do:** A pure move with no change in behaviour, per Decisions → "The shared team UI moves": `git mv`, rename each moved export's `AdminModule_` prefix to `Teams_`, and fix the imports. Moved files import each other relatively within `src/components/teams/`. No extractions here.
  - **Done when:** `npm run check` passes; `grep -rn "org-admin/components/teams/\(update-team\|team-access-card\|grant-team-access\|revoke-team-access\|d4h-link-card\|add-team-membership\|remove-team-member\|membership-source-badge\|d4h-member-status-badge\)" src` finds nothing.

- [x] **Task 1b: extract the details card, members table and D4H menu group** (refactor(teams): extract shared team details, members table and D4H menu)
  - **Files:** new `src/components/teams/{team-details-card,team-members-table}.tsx`, `src/components/teams/d4h-link-card.tsx`, `src/modules/org-admin/components/teams/{team-content,team-members-list,team-menu}.tsx`
  - **Do:** Extract `Teams_Details_Card` (the Team Details card with its `<Protect>`ed update dialog), `Teams_Members_Table` (`team-members-list.tsx`'s `columns`/`useReactTable`/toolbar/table/pagination; it takes `team`, `memberships` and `rowAction: (row) => ReactNode` for the last column) and `Teams_D4HMenuGroup` (`team-menu.tsx`'s `after` content; it takes `team` and the `setAction` it calls). Org admin uses all three and passes its chevron link as `rowAction`.
  - **Done when:** `npm run check` passes; Admin → Teams → a team, its members and a membership render and behave as before (spot-checked in the browser at the group's end).

- [x] **Task 2: scope options on the shared team UI** (feat(teams): let the shared team UI run outside org admin)
  - **Files:** `src/lib/schemas/team.ts`, `src/lib/schemas/team.test.ts`, `src/components/teams/{update-team,team-details-card,team-access-card,revoke-team-access,d4h-link-card,team-members-table}.tsx`
  - **Do:** Per Decisions → "Shared components stay scope-agnostic" and "Revoking your own grant":
    - `TeamData.formSchema(storedSlug, { requireSlug = false } = {})`: with `requireSlug`, a null/empty slug fails with a message saying a team in its own space needs a slug, and that clearing it is done from the organisation's Admin → Teams.
    - `Teams_UpdateTeam_Dialog`: `requireSlug?: boolean` (passed to the schema; the slug field's description changes to match) and `onUpdated?: (updated: TeamData) => void`. When `onUpdated` is given, call it instead of closing the dialog (the `onRemoved` pattern in `remove-team-member.tsx`). `Teams_Details_Card` passes both through.
    - `Teams_D4HCard`: `onChanged?: () => void`, called after a successful link, unlink or sync. For link and unlink, call it only after the card's own `setAction` promise resolves (`await setAction("d4h-sync", …)` after a link, `await setAction(null, …)` after an unlink), per Decisions → "Keeping team scope fresh". Sync changes no URL, so call it right away.
    - `Teams_TeamAccess_Card`: `linkPeople?: boolean` (default `true`; plain `grant.user.name` when false) and `onSelfRevoked?: () => void`. The card computes `isSelf` (`grant.userId` against `useUser()` from `@/client/auth-queries`) and passes it to the revoke dialog, which adds the self-revoke sentence when it's true. On success, when `isSelf` and `onSelfRevoked` is given, the card calls it instead of closing; otherwise it closes as now.
    - `Teams_Members_Table`: `linkPeople?: boolean` (default `true`; plain `person.name` when false).
  - **Done when:** `team.test.ts` covers `formSchema` with `requireSlug` (null and `""` fail; a changed slug passes; a reserved new slug still fails) and without it (null still passes). Org admin is unchanged apart from the self-revoke sentence. `npm run check` passes.

_End of review group A._ Browser spot-check: Admin → Teams → a team and its members, unchanged.

### Review group B: the team admin pages

- [x] **Task 3: register `team-admin` and add the overview page** (feat(team-admin): add the team admin overview) · `visual`
  - **Files:** `src/lib/modules.ts`, `src/lib/modules.test.ts`, `src/app/(wrapper)/(authenticated)/teams/[slug]/admin/page.tsx` (new), `src/modules/team-admin/components/team-admin-content.tsx` (new), `src/modules/team-admin/components/team-menu.tsx` (new), `src/modules/team-admin/components/members-link-card.tsx` (new), `content/help/team-admin.mdx` (new)
  - **Do:**
    - Registry per Decisions → "Registry". Update the comments that say no team module exists yet. `modules.test.ts`: `teamModules` on the real registry is now the one `team-admin` entry, and `moduleHref("team-admin", …)` gives `/teams/<slug>/admin` in team scope and `undefined` in org scope. Run `npx next typegen` after adding the page (the registry's `route()` needs it).
    - **Page**, following `docs/patterns/detail-page-data-fetching.md` and modelled on `orgs/[slug]/admin/teams/[team_id]/page.tsx`: `requireTeam(slug)` (cached per request; read for the ids and roles, it guards nothing). Prefetch `teams.getTeam({ organizationId, teamId })` and `teams.listTeamMemberships` (for the Members card; both need `team: ["view"]`, as the whole page does), and `teamUsers.listTeamUsers` only with `member: ["view"]` (`hasAnyRoleWithPermissions`). Static `metadata` title `"Admin"` (the team layout's template adds the team name).
    - **Content** (`TeamAdmin_Overview_Content`): `Std.Navbar` breadcrumbs `[{ label: team.name, href: /teams/[slug] }, "Admin"]` with `<HelpButton id="team-admin" />`; `Saratoga.Root` with the title "Team Admin" and `TeamAdmin_Team_Menu` in Actions. Main column: `Teams_Details_Card` (`requireSlug`, `onUpdated`), the Access card in `<Protect permissions={{ member: ["view"] }}>` (`linkPeople={false}`, `onRevoked`), `Teams_D4HCard` (`onChanged`). Secondary: `TeamAdmin_MembersLink_Card` ("N Personnel" → `/teams/[slug]/admin/members`, like org admin's `team-links.tsx`). No `<Protect>` around it: the page already needs `team: ["view"]`. Read the team with `useSuspenseQuery(teams.getTeam)`, and the ids from `useTeam()`/`useOrganization()`.
    - **Handlers**, per Decisions → "Keeping team scope fresh" and "Revoking your own grant": `onUpdated` → `router.replace` to the new slug's `/admin` when the slug changed, otherwise `await setAction(null, { history: "replace" })` then `router.refresh()` (as `src/modules/skill-track/components/update-session.tsx`); `onChanged` → `router.refresh()`; `onSelfRevoked` → `router.replace("/user")`.
    - **Menu** per Decisions → "Team admin's own menu", gated per `docs/patterns/protect-permission-gating.md`.
    - **Help card** per Decisions → "Help card", written from the screen per `content/README.md` (about 150 words): what team admin is for, Edit (the slug can change but not be cleared here), Access, D4H, Members, and that archiving and deleting stay in the organisation's Admin → Teams. Run `npx content-collections build` afterwards: a bad `guide` is fatal only there.
  - **Done when:** as a user granted the team with `team: ["update"]` and `member: ["update"]`: `/teams/<slug>/admin` shows the three cards and the menu; editing the name updates the page, the sidebar's scope switcher label and the window title without a reload; changing the slug lands on `/teams/<new-slug>/admin`; clearing the slug is refused in the form; revoking your own grant lands on `/user`, and the team has gone from the switcher. As a plain `member`: no edit pencil or menu actions enabled, and no Access card. As a granted user with only `i3-editor`: the team's `forbidden.tsx`, and no Members sub-item. `npm run check` passes (including `help-cards.test.ts`).

- [x] **Task 4: the members page and the sidebar menu** (feat(team-admin): add the team admin members page) · `visual`
  - **Files:** `src/app/(wrapper)/(authenticated)/teams/[slug]/admin/members/page.tsx` (new), `src/modules/team-admin/components/members-list.tsx` (new), `src/modules/team-admin/components/sidebar-menu.tsx` (new), `src/components/nav/team-sidebar-modules.tsx`
  - **Do:** The `?action=add-membership` and `?action=remove&personId=` wiring follows `docs/patterns/mutation-dialog.md`.
    - **Page:** as Task 3's, prefetching `teams.getTeam` and `teams.listTeamMemberships` (the page is the roster, so no role check: without `team: ["view"]` it fails `FORBIDDEN` like org admin's members page). Static title `"Members"`.
    - **Content** (`TeamAdmin_Members_List`), modelled on org admin's `team-members-list.tsx`: breadcrumbs `[team.name → /teams/[slug], Admin → /teams/[slug]/admin, "Members"]` with the help button; title "Members"; **New Member** in Actions (`<Protect permissions={{ team: ["update"] }}>`) opening `Teams_AddTeamMembership_Dialog` on `?action=add-membership`; then `Teams_Members_Table` with `linkPeople={false}` and a `rowAction` that renders a Remove icon button (`aria-label="Remove <name> from the team"`, inside `<Protect permissions={{ team: ["delete"] }}>`) setting `?action=remove&personId=<id>` (nuqs, as `team-access-card.tsx` does for revoke). `Teams_RemoveTeamMember_Dialog` resolves the person from the memberships and closes on success (no `onRemoved`).
    - **Sidebar** per Decisions → "Sidebar".
  - **Done when:** the sidebar shows Admin with Members under it, in team scope only; `/teams/<slug>/admin/members` lists the roster with plain names; New Member adds someone, and they show on the table and the team dashboard's roster without a reload; Remove takes them off; without `team: ["delete"]` the Remove buttons are absent. `npm run check` passes.

- [x] **Task 5: developer docs** (docs(team-admin): document the team admin module) · `mechanical`
  - **Files:** `AGENTS.md`
  - **Do:** In → Scope roots and modules, name `team-admin` as the first team-only module (`/teams/[slug]/admin`) and say it writes through the org procedures with the team's ids, like every team page. In → Modules, add that `src/components/teams/` holds the team record cards and dialogs that org-admin and team-admin share, as distinct from `src/components/team/` (the team scope root's own UI).
  - **Done when:** the docs match the code. `npm run check` passes.

_End of review group B._ Visual checkpoint: the overview (both permission levels), a rename, the members page, add and remove, and self-revoke.

## Docs impact

New: team scope gains **Admin** (`/teams/<slug>/admin`, with Details, Access, D4H and a Members page), where people granted a team edit its name, slug and description, its roster, its access grants and its D4H link. Likely a "Team admin" section in the milestone's new team-scope guide, with screenshots of the overview and members pages. The Admin → Teams guide (`content/docs/admin/teams.mdx`) might gain a line pointing team admins there.

## Out of scope

- Archive, restore, delete and recover from team scope; the History and membership detail pages in team scope.
- Clearing a team's slug from team scope.
- Team-scope procedures, or making the grant a data boundary (#528).
- Any org module joining team scope (#527 Skill Track, #529 D4H Today).
- Per-team module enabling.

## Parked

(none yet)

## Review notes

- (group A) `src/components/teams/revoke-team-access.tsx`: the self-revoke sentence "You'll lose access to this team's space." also shows in org admin for a team with no slug, which has no space. Show it only when `team.slug` is set.
- (group A, watch only) `d4h-link-card.tsx`: `onSynced` fires as soon as the sync succeeds, possibly before a mid-apply close has cleared `?action=d4h-sync`. If the Task 3 browser check shows the sync dialog reopening after a close mid-apply, wait for the URL change there too.
- (group B) `team-admin-content.tsx`: after a rename or a self-revoke, `router.replace` swaps only the dialog's pushed `?action=…` entry, so Back still reaches `/teams/<old>/admin` (a not-found). Accept the extra history entry; correct the code comment and this plan's Decisions → "Revoking your own grant" wording so they don't claim Back avoids it.
- (group B) Make the sync path safe as well, rather than only watching for it: `SyncDialog` calls `onSynced` (and so team admin's `router.refresh()`) when the dialog **closes** after a successful sync, after `await setAction(null, { history: "replace" })`, not as soon as the mutation succeeds. That replaces the group A "watch only" note above.
- (group B) `content/help/team-admin.mdx`: the members page shares the card, so add a sentence on it: **New Member** adds someone, and the row's remove button takes them off. Stay under 250 words.
