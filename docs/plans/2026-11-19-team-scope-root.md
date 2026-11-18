# The team scope root: `/teams/[slug]`

**Date:** 2026-11-19
**Issue:** [#524](https://github.com/redcloud-nz/avut/issues/524), part of the team-scope tracking issue [#520](https://github.com/redcloud-nz/avut/issues/520) (design: redcloud-nz/avut-ideas#40). Milestone v0.13.
**Branch:** `feat/team-scope-root`, worktree `.claude/worktrees/team-scope-root` (dev server on its `.dev-port`, 3102)
**DB:** no migration. `Team.slug` and `TeamUser` already exist (#521, #522, PR #536). Shared `avut` is fine.
**Written against:** integration @ ba30fb40

Adds a fourth scope root, **team**, next to organization, user and system. A user reaches `/teams/[slug]` through a `TeamUser` grant on a team that has a slug. This PR builds the foundations: the registry, the access check, the layout and sidebar, a team dashboard, and the scope switcher entry. No module joins the team scope yet. `team-admin` (#525) and Skill Track (#527) build on this.

## Decisions

- **`teamProcedure` takes the team slug.** Input `{ teamSlug: string }` (`TeamSlug.shapeSchema`), as the issue says. The procedure resolves it across all orgs (see the access check below). Pages and client components then need only the URL's slug, with no slug → id step in front of every call.
- **Who gets in.** In order, each failure **`NOT_FOUND`** (so a slug's existence isn't revealed to someone without a grant):
  1. a team with that slug exists and its `status` is `Active` (an Archived or Deleted team has no team scope, the same rule that refuses new grants on a non-Active team);
  2. the caller holds a `TeamUser` row for it.

  Then `ctx.hasPermission(team.organizationId, requiredPermissions)` applies the usual org-wide permission check (it also confirms org membership; the grant's composite FK already implies it). `teamProcedure()` with no permissions means "anyone granted the team".

- **One access check, in the service layer** (plan review). `Teams.getGrantedBySlug(prisma, slug, userId)` in `src/server/services/teams.ts` applies both checks above and returns the team, with its `d4h` link and org ref, in the `teamScope.getTeam` output shape, or `null`. Like the existing `Teams.getBySlug`, it takes `prisma` rather than an org ctx because it looks across all orgs. `teamProcedure`, `teamScope.getTeam` and `requireTeam` all call it, so the rule lives and is tested in one place.
- **No mutations, no D4H token.** This PR adds no writes, so no new permission-gated mutations and no `ctx.logEvent` calls. The D4H link card reads only the stored `Team_D4H` row and never calls the D4H API, so there is no token path.
- **No system-admin bypass and no implicit admin access.** Team access is always an explicit grant (avut-ideas#40). `teamProcedure` has no `allowSystemAdmin` option.
- **The context is an org context plus the team.** `AuthenticatedTeamContext = AuthenticatedOrganizationContext & { teamId: TeamId; teamSlug: string }`, with `organizationId` taken from the team and `isSystemAdmin: false`. Every existing `OrgServiceContext` service then works unchanged from a team procedure. `ctx.logEvent` writes to the **organization's** log, exactly as `organizationProcedure`'s does (factor the shared `logEvent` builder rather than copy it).
- **Server-side shell access: `requireTeam(slug)`** in a new `src/server/team-access.ts`, the counterpart of `requireOrganization`: React-`cache`d per request on the slug, `notFound()` when `getGrantedBySlug` returns `null`. It returns `{ session, team, organization, settings, roles }`, the last three from the existing org caches, so the layout can seed both the team and the org queries. As with the org layout, this is for a correct first response and the shell's data, not a guard (`docs/patterns/route-access-control.md`).
- **Team pages sit inside an `OrganizationProvider` for the team's org**, as well as a new `TeamProvider`. `<Protect>`, `useHasPermission` and `isModuleEnabled` all read `useOrganization()`, and shared module components will need them in team scope too. `useOrganization` reads `organizations.getOrganization`, which is membership-only since #523, so a granted user can always read it.
- **`useTeam()`** (`src/hooks/use-team.tsx`) mirrors `useOrganization`: `TeamProvider` carries only the slug, and the hook reads `teamScope.getTeam` with `useSuspenseQuery`, which the layout seeds.
- **Registry shape for modules that span scopes.** `ModuleScope` gains `"team"`. `scope` stays the single discriminant the derived lists use, and an org module that also lives in team scope declares it with an optional `team?: { segment?: string; href: (teamSlug: string) => Route }` on `OrganizationModuleDef` (segment defaults to the org one). This is #524's `scopes: ["organization", "team"]` with the per-scope segment and typed href in one place. A team-only module (#525's `team-admin`) is a `TeamModuleDef` with `scope: "team"` and `href: (teamSlug) => Route`. `TeamModuleId` starts as `never`; #525 adds the first. Enabling stays the one `OrganizationSettings.modules` key. Team-only modules are always `alwaysOn` (like `org-admin`), since they have no settings key.
- **`teamModules`** is derived like `orgModules`: every `scope: "team"` module plus every org module with a `team` entry, in registry order, normalised to `{ id, label, icon, alwaysOn, href(teamSlug) }`, typed so that a non-`alwaysOn` entry's `id` is an `OrganizationModuleId` (the sidebar filters with `m.alwaysOn || isModuleEnabled(m.id)`). The derivation is a pure exported function so a test can feed it fixtures; it's empty on the real registry for now.
- **Scope-aware links.** `ScopeRef = { scope: "organization" | "team"; slug: string }`. `scopedRoute(ref, { organization: "/orgs/[slug]/…", team: "/teams/[slug]/…" }, params)` in `src/lib/scoped-routes.ts` picks the pattern for the ref's scope and fills `slug` from the ref, so both patterns stay typed routes (both roots name their param `[slug]`). `useScopedRoute()` binds it to `useCurrentScope()` and throws outside the org and team scopes. `moduleHref(moduleId, ref)` in `modules.ts` gives a module's root in either scope (`undefined` when the module isn't in that scope).
- **Sidebar.** A new `src/components/nav/team-sidebar-modules.tsx`, portalled from the team layout like `org-sidebar-modules.tsx`: a hardcoded **Dashboard** item, then the enabled `teamModules`, each with an optional sub-menu from a `TEAM_MODULE_SIDEBAR` map (empty for now). Lint's allow-list of files that may import `src/modules/` (`eslint.config.mjs`) gains this file.
- **Scope switcher.** `useCurrentScope()` returns `{ scope: "team", slug }` under `/teams/`. A **Teams** group, below Organisations, lists the teams the caller is granted that have a slug and are Active (new `user.listTeamGrants`, prefetched by the authenticated layout). Each entry shows the team name, with its org's name as muted secondary text only when the caller is in more than one org. Users icon (`UsersIcon`). The group is hidden when there are none. In team scope the trigger shows the team's name.
- **The Teams group stays fresh** (plan review). Granting yourself access is the normal way in, so every mutation that changes whether a team qualifies invalidates `user.listTeamGrants`: grant and revoke, and team update (slug, name), archive, restore, delete, recover, and the Rubbish bin's team restore and purge.
- **Dashboard.** `/teams/[slug]` shows the team's name and description (and its org's name), its **D4H link** (the linked D4H team name and server, or "Not linked to D4H"), and its **roster**: the Active `TeamMembership`s, by person name, with D4H position and ref when present. The roster comes from `teamScope.listRoster`, `teamProcedure({ team: ["view"] })`, and its card is wrapped in `<Protect permissions={{ team: ["view"] }}>`. Names are plain text, not `PersonLink`s: those go to org admin pages, which a team-only user won't be able to open once #528 lands. Its content component lives in `src/components/team/` (a scope-root page, not a module, like `components/organization/dashboard-content.tsx`).
- **No help card.** The org dashboard has none either, and there's no `<HelpButton>` to wire one to.

## Tasks

### Review group A: data layer

- [x] **Task 1: module registry** (feat(modules): add the team scope to the module registry)
  - **Files:** `src/lib/modules.ts`, `src/lib/modules.test.ts` (new or extended), `src/lib/schemas/log-entry.ts` (only its comment about `ModuleScope`'s values, if it stops being true)
  - **Do:** Per Decisions: `ModuleScope` gains `"team"`; add `TeamModuleId` (`never` for now), `TeamModuleDef` (always `alwaysOn`), the optional `team` entry on `OrganizationModuleDef`, the pure `deriveTeamModules(list)` and `teamModules`, `ScopeRef`, and `moduleHref(moduleId, ref)`. Update the comments that say "three scope roots".
  - **Done when:** tests cover `deriveTeamModules` (a `scope: "team"` fixture, an org fixture with `team`, one with a different team segment, one without, registry order kept) and `moduleHref` for both scopes and for a module absent from a scope. `teamModules` on the real registry is `[]`. `npm run check` passes.

- [x] **Task 2: the team access check** (feat(teams): add the team scope access check)
  - **Files:** `src/server/services/teams.ts`, `src/server/services/teams.test.ts`, `src/lib/schemas/team-scope.ts` (new: the `teamScope.getTeam` output shape)
  - **Do:** Add `Teams.getGrantedBySlug(prisma, slug, userId)` per Decisions. It returns `{ id, name, slug, description, organization: { id, name, slug }, d4h: { d4hTeamId, d4hTeamName, d4hServerCode } | null }`, or `null` when the team is missing, not `Active`, or not granted to `userId`. **One round trip** (user, 2026-11-19: access-check cost matters): a single `team.findUnique({ where: { slug }, select: { …, d4h, organization: { select: { id, name, slug } }, teamUsers: { where: { userId }, select: { id: true } } } })`, then check `status` and `teamUsers.length` in memory. Go through `Team.teamUsers` (FK `teamId`), never an `include` through `TeamUser`'s composite `organizationUser` relation (prisma-mock; see `src/server/services/team-users.ts`).
  - **Done when:** service tests cover granted (with and without a D4H link), unknown slug, Archived, Deleted, ungranted, and a grant on a different team. `npm run check` passes.

- [x] **Task 3: `teamProcedure`** (feat(trpc): add teamProcedure for the team scope)
  - **Files:** `src/trpc/init.ts`, `src/trpc/init.test.ts`, `src/trpc/CLAUDE.md`
  - **Do:** Add `teamProcedure(requiredPermissions = {})` per Decisions, built on `authenticatedProcedure`, with `.meta({ requiresTeam: true, requiredPermissions })` (there's no declared meta type and nothing reads it, so pass it as `organizationProcedure` does), `.input(z.object({ teamSlug: TeamSlug.shapeSchema }))`, `Teams.getGrantedBySlug` for the access check, and the `AuthenticatedTeamContext`. Factor `organizationProcedure`'s `logEvent` into a shared helper that both use. Throw `TRPCError` `NOT_FOUND` with a message that doesn't say which check failed. In `src/trpc/CLAUDE.md`, add `teamProcedure` to the router conventions and to the `logEvent` table (writes `scope: "organization"`, the team's org).
  - **Done when:** `init.test.ts` covers: a granted member with no permissions passes, with `ctx.teamId`/`organizationId`/`teamSlug` set; `getGrantedBySlug` returning null → NOT_FOUND; granted but missing the required permission → FORBIDDEN; a system admin with no grant → NOT_FOUND; `ctx.logEvent` writes an organization-scope entry for the team's org. `npm run check` passes.

- [x] **Task 4: `teamScope` router and `user.listTeamGrants`** (feat(trpc): add the teamScope router and user.listTeamGrants)
  - **Files:** `src/trpc/routers/team-scope-router.ts` (new), `src/trpc/routers/team-scope-router.test.ts` (new), `src/trpc/routers/_app.ts`, `src/trpc/routers/user-router.ts`, `src/trpc/routers/user-router.test.ts`, `src/lib/schemas/team-scope.ts`, `src/server/services/teams.ts` (roster list), `src/server/services/team-users.ts` and its test (`listForCaller`)
  - **Do:** Follow `src/trpc/CLAUDE.md` and `src/server/services/CLAUDE.md` (procedures in alphabetical order, reads in the service layer).
    - `teamScope.getTeam`: `teamProcedure()`, returning the Task 2 shape.
    - `teamScope.listRoster`: `teamProcedure({ team: ["view"] })`. The team's `Active` memberships as `{ id, person: { id, name }, d4h: { d4hPosition, d4hRef } | null }`, ordered by person name. Reuse what `teams.listTeamMemberships` uses underneath if it fits.
    - `user.listTeamGrants`: `authenticatedProcedure`, calling a new `TeamUsers.listForCaller(ctx: UserServiceContext)`. The caller's grants whose team has a non-null slug and is `Active`, as `{ team: { id, name, slug }, organization: { id, name, slug } }`, ordered by org name then team name. No `include` through the composite relation.
  - **Done when:** tests cover each procedure's happy path; `listRoster` leaves out Archived/Deleted memberships and refuses a granted user without `team: ["view"]`; `listForCaller` leaves out unslugged and Archived teams and other users' grants, and spans two orgs. `npm run check` passes.

- [x] **Task 5: `requireTeam`** (feat(teams): add requireTeam for the team scope shell)
  - **Files:** `src/server/team-access.ts` (new), `src/server/team-access.test.ts` (new)
  - **Do:** Per Decisions, mirroring `src/server/organization-access.ts`: `import "server-only"`, React `cache` keyed on the slug alone, `requireSession()`, `Teams.getGrantedBySlug`, `notFound()` on `null`, then the org (by id, `OrganizationData.fromRecord`), `getOrganizationSettings` and `getOrganizationUserRoles`. Model the test on `src/server/organization-access.test.ts` (it `vi.mock`s `./session`, `./cache/*` and `next/navigation`).
  - **Done when:** tests cover granted (returns team, org, settings and roles) and `getGrantedBySlug` → null (calls `notFound()`). `npm run check` passes.

_End of review group A._

### Review group B: team scope UI

- [x] **Task 6: `/teams/[slug]` layout, providers and sidebar** (feat(teams): add the /teams/[slug] layout, providers and sidebar) · `visual`
  - **Files:** `src/app/(wrapper)/(authenticated)/teams/[slug]/layout.tsx`, `…/teams/[slug]/{error,forbidden,not-found,loading}.tsx` (new, modelled on `orgs/[slug]`'s), a placeholder `…/teams/[slug]/page.tsx`, `src/hooks/use-team.tsx` (new), `src/components/nav/team-sidebar-modules.tsx` (new), `eslint.config.mjs`
  - **Do:** The layout follows `orgs/[slug]/layout.tsx`: `generateMetadata` uses `fetchQuery(trpc.teamScope.getTeam…)` for the title template (`%s · <team> | AVUT`), never `requireTeam`. The layout calls `requireTeam(slug)` and `resolveModuleFlags()`, seeds `teamScope.getTeam`, `organizations.getOrganization`, `settings.getOrganizationSettings` and `organizations.getMyRoles` with `queryClient.setQueryData`, and renders `HydrateClient` › `OrganizationProvider` › `TeamProvider` › `SidebarPortal` with `TeamSidebar_Modules`, then children. The sidebar is per Decisions. Run `npx next typegen` after adding the route.
  - **Done when:** as a granted user, `/teams/<slug>` renders inside the app shell with the team sidebar (just Dashboard); an ungranted user, an unknown slug and an Archived team's slug get the not-found panel. `npm run check` passes.

- [x] **Task 7: current scope and scoped links** (feat(teams): add team to useCurrentScope and a scopedRoute helper)
  - **Files:** `src/hooks/use-current-scope.ts`, its test (new or extended), `src/lib/scoped-routes.ts` (new), `src/lib/scoped-routes.test.ts` (new), `src/hooks/use-scoped-route.ts` (new), `src/components/nav/scope-switcher.tsx` (only minimal `team` entries in `ScopeIcons`/`ScopeLabels`, so it typechecks)
  - **Do:** `useCurrentScope` returns `{ scope: "team"; slug }` for `/teams/<slug>…`. Add `scopedRoute` (typed with `AppRoutes`/`ParamMap` from `.next/types/routes`, like `route()` in `src/lib/routes.ts`; params are the patterns' params minus `slug`) and `useScopedRoute()`, per Decisions. After Task 6, `/teams/[slug]` exists as a typed route to test with.
  - **Done when:** tests cover `useCurrentScope` for `/teams/x`, `/teams/x/y`, `/orgs/x` and `/user`, and `scopedRoute` for both scopes. `npm run check` passes.

- [x] **Task 8: team dashboard** (feat(teams): add the team dashboard) · `visual`
  - **Files:** `src/app/(wrapper)/(authenticated)/teams/[slug]/page.tsx`, `src/components/team/dashboard-content.tsx` (new)
  - **Do:** Follow `docs/patterns/detail-page-data-fetching.md`. The page prefetches `teamScope.listRoster` only when the caller's roles hold `team: ["view"]` (as the org dashboard does with `hasAnyRoleWithPermissions`), and renders the shell (`Std.Navbar` with the team as the breadcrumb, `Std.ScrollContainer`). The content component reads `useTeam()` and lays out `Saratoga.Root`/`Header`/`Title` (team name, org name beneath) and `Saratoga.Columns`: the roster card in `main` (inside `<Protect permissions={{ team: ["view"] }}>`, with an empty state), and the About and D4H link cards in `secondary`. Reuse the existing card and data-item components in `src/components/cards`/`ui`.
  - **Done when:** the dashboard shows the name, description, D4H link (both states) and roster for a granted team; a granted user without `team: ["view"]` sees no roster card and makes no failed request. `npm run check` passes.

- [x] **Task 9: scope switcher** (feat(teams): add granted teams to the scope switcher) · `visual`
  - **Files:** `src/components/nav/scope-switcher.tsx`, `src/app/(wrapper)/(authenticated)/layout.tsx`, `src/client/team-users-effects.ts`, `src/client/teams-effects.ts`, `src/client/trash-effects.ts`
  - **Do:** Per Decisions. Read `user.listTeamGrants` in the switcher's `useSuspenseQueries` alongside `listMemberships`, and `prefetch` it in the authenticated layout next to `listMemberships`. Show the current team's name in the trigger, and add the Teams group. Update the component's docstring ("three scope roots"). Add `invalidate(trpc.user.listTeamGrants.queryFilter())` to the effects of `grantTeamAccess`, `revokeTeamAccess`, `updateTeam`, `archiveTeam`, `restoreTeam`, `deleteTeam`, `recoverTeam`, and the Rubbish bin's team restore and purge.
  - **Done when:** the switcher lists granted, slugged, Active teams and links to `/teams/<slug>`; it shows the team name while in team scope; the Teams group is absent for a user with no such grants; granting yourself access in Admin → Teams shows the team in the switcher without a reload. `npm run check` passes.

- [x] **Task 10: developer docs** (docs(teams): document the team scope root) · `mechanical`
  - **Files:** `AGENTS.md`, `docs/patterns/route-access-control.md`
  - **Do:** In `AGENTS.md` → Scope roots and modules: four roots, with **team** (`/teams/[slug]/…`, reached through a `TeamUser` grant on a slugged, Active team, checked by `teamProcedure`); the `team` entry on org modules and `TeamModuleDef`; `scopedRoute`/`useScopedRoute` for links from components used in both scopes. In → Modules, the files allowed to import `src/modules/` include `nav/team-sidebar-modules.tsx`. In `route-access-control.md`: add `teams/[slug]/layout.tsx` → `requireTeam(slug)` → "404 without a grant; loads the shell's team, org and roles" to the layouts table, and a sentence that team-scope reads go through `teamProcedure`. Add `teams/[slug]` to the list of boundary files (`forbidden.tsx`/`not-found.tsx`).
  - **Done when:** the docs match the code. `npm run check` passes.

_End of review group B._ Visual checkpoint: the dashboard, the not-found cases and the switcher.

**Checkpoint before `/avut-ship`: access-control review** (user, 2026-11-19). The user reviews the access-control code themselves, chiefly for DB round trips: `Teams.getGrantedBySlug`, `teamProcedure` (with `ctx.hasPermission`), `requireTeam`, and the team layout and dashboard page. Give them a round-trip count per path: one team procedure call, a full page load of `/teams/[slug]`, and a client-side navigation. Wait for their go-ahead before shipping.

## Docs impact

New: a team scope at `/teams/<slug>`, reached from the scope switcher's new Teams group, with a team dashboard (name, roster, D4H link). Likely a new guide page on team scope (or a section in the guide that covers the scope switcher), and the scope-switcher screenshot changes.

## Out of scope

- The `team-admin` module (#525) and any module joining team scope (#527 Skill Track, #529 D4H Today).
- Narrowing the org scope to `organization: ["view"]` (#528).
- Per-team module enabling (`TeamConfig`).
- Team scope for Archived teams, and redirects after a slug rename (decided against in #521).
- A system-admin way into a team without a grant.

## Parked

## Review notes

- (group A) `Teams.listRoster` filters only on membership `status: "Active"`, so an archived or binned person with an Active membership still shows. Add `person: { status: "Active" }` to the `where`, with a test (the `skill-checks-router.ts:282` pattern).
- (group A) The grant query repeats within one request: `getGrantedBySlug` runs in `requireTeam` and again in each `teamProcedure` call (a team page that prefetches `getTeam` and `listRoster` runs it three times). Add a React `cache()`-wrapped `(slug, userId)` variant that both call. Outside RSC `cache` is a passthrough, so tests and the HTTP handler behave as before.

For the access-control checkpoint (the user decides, not fixed by default):

- `teamProcedure` makes two sequential round trips on a cold role cache (the grant query, then `hasPermission`'s role lookup). The roles could ride along in the grant query and be checked in memory with `hasAnyRoleWithPermissions`, at the cost of the cross-request `"use cache"` hit and some duplicated logic from `trpc-context.ts`.
- `requireTeam` calls `getOrganizationBySlug` for an org the grant query already joined. It's a `"use cache"` lookup, so only a miss costs anything. Selecting the full org row in `getGrantedBySlug` would remove it, but widens `TeamScopeTeamData`.
