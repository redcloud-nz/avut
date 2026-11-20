# Team slugs and access grants

**Date:** 2026-11-18
**Issues:** [#521](https://github.com/redcloud-nz/avut/issues/521) (optional, globally unique team slugs), [#522](https://github.com/redcloud-nz/avut/issues/522) (team access grants, `TeamUser`). Milestone v0.13, one PR.
**Branch:** `feat/team-slugs-grants`, worktree `.claude/worktrees/team-slugs-grants`
**DB:** two migrations on one branch database. Before Task 1, the orchestrator runs `npm run db:branch team-slugs-grants`, which needs every connection to `avut` closed (the user's dev server and Prisma Studio too). Each `npm run prisma migrate dev` still needs the user's permission.
**Written against:** integration @ 32d8c9c0

Both issues add team data with admin UI on the same page (`orgs/[slug]/admin/teams/[team_id]`). They are the groundwork for #524 (team scope root `/teams/[slug]`, guarded by `TeamUser`) and #525 (`team-admin` module).

## Decisions

- **Slug shape.** A new `TeamSlug` schema in `src/lib/schemas/team.ts`: 2–50 characters, `^[a-z0-9-]+$` (the same rule as `OrganizationData.createSchema`'s slug), and not one of `TEAM_SLUG_RESERVED`. The list is `["admin", "api", "create", "edit", "new", "settings"]`. No `/teams` routes exist yet, so these words are held back for static siblings #524 might add under `/teams/`. The message is "That slug is reserved."
- **Slug uniqueness is global.** `Team.slug String? @unique`. Postgres allows any number of NULLs, so unslugged teams don't collide. The router checks first and throws `FieldConflictError("slug", …)` (the `organization-groups-router` shape), and the unique index is the backstop.
- **No backfill, and clearing is allowed.** A null slug means the team has no team scope. Setting one turns it on, and clearing it (an empty field) turns it off. The form sends `""`, and the input schema turns that into `null`.
- **No redirects after a rename** (user, 2026-11-18). A rename frees the old slug at once, with no history table.
- **Slug edits go through the existing team create and update.** `slug` joins `TeamData.modifiableSchema`, so it's in the Create Team and Update Team dialogs and is logged by the existing `Create`/`Update` `Team` events through `diffObject`. A soft-deleted (`Deleted`) team keeps its slug, which stays taken until the team is purged.
- **`TeamUser` model.** `id`, `organizationId`, `teamId`, `userId`, `createdAt`, `@@unique([teamId, userId])`, `@@index([organizationId, userId])`, `@@map("team_users")`. Relations:
  - `team` → `Team`, `onDelete: Cascade`
  - `organizationUser` → `OrganizationUser` through the **composite** `fields: [organizationId, userId], references: [organizationId, userId]`, `onDelete: Cascade`. The DB then enforces "the user is a member of the team's org", and it is the backstop when someone leaves the org or is removed from it.
  - `user` → `User`, `onDelete: Cascade`, a direct relation alongside the composite one, with a `teamUsers` back-relation on `User`. **The service never traverses the composite relation.** prisma-mock 1.1.0 resolves relations by the first FK field only, so in tests an `include` through it would match the wrong member, and its cascade would wipe the whole org's grants. User details come from `user`, and `personId` from an explicit `organizationUser.findUnique({ where: { organizationId_userId } })` (or `user.organizationUsers` filtered by org). Cascade behaviour can't be tested with prisma-mock.
  - Relation names follow the schema's convention: `"team_user_to_team"`, `"team_user_to_user"`, `"team_user_to_organization_user"`.
  - The service checks that the team is in `ctx.organizationId`, since the schema can't tie `teamId` to `organizationId`.
- **Explicit cleanup on top of the cascade.** `UserAccounts.purge` clears dependent rows explicitly by policy, so it gains `teamUser.deleteMany({ where: { userId } })`. The two membership-removal paths, `organizations-router` `removeOrganizationMember` and `user-router` `leaveOrganization`, gain `teamUser.deleteMany({ where: { organizationId, userId } })` in their existing `$transaction`. None of these writes a `TeamUser` log entry: the membership removal or the purge is the logged event.
- **Soft-deleted users.** Their `OrganizationUser` row is kept for recovery, so their grants are kept too. The lists hide them (`user.status: { not: "Deleted" }`), and the grants come back when the user is recovered.
- **No D4H code path.** Nothing here depends on a D4H token.
- **No link to the roster** (#522). A user's roster entry is found through `OrganizationUser.personId` → `TeamMembership`. The grants list shows it as an "On roster" badge, read-only.
- **Grants are rows, not records.** There is no `status`, no Rubbish bin and no tags or properties. Granting creates a row and revoking hard-deletes it, each paired with a `ctx.logEvent` in a `$transaction`. `LogObjectType` gains `"TeamUser"`, attributed to `org-admin`. Entries carry `context` refs to the `Team` and the `User`, so they show on both timelines.
- **Who can grant.** The router procedures use the existing user-management permissions: list with `member: ["view"]`, grant and revoke with `member: ["update"]`. Org admins and owners get no implicit team access, but they can grant themselves. A grant needs an **Active** team, and a member whose user isn't soft-deleted (the `activeMember` rule in `organizations-router.ts`). Granting twice is a `ConflictError`.
- **Org-scoped user link** (orchestrator, Task 8). `UserLink` goes to the system admin's user page, which org admins can't open. A new `OrgUserLink` in `src/components/entity-links/` links to `/orgs/[slug]/admin/users/[user_id]` through `useOrganization()`, and the Access card uses it. `UserLink` is unchanged; `docs/patterns/entity-link.md` lists both.
- **Grant picker list** (orchestrator, Task 8). `organizations.listMembers` doesn't drop soft-deleted users or say which they are, so the grant dialog reads a new `TeamUsers.listGrantableUsers(ctx, teamId)` instead: members whose user isn't `Deleted` and who have no grant on the team, by name, with no include through the composite relation. It's exposed as `teamUsers.listGrantableUsers` (`member: ["view"]`), and the grant and revoke effects invalidate it.
- **Invitation acceptance honours `OrganizationInvitation.teamId`** (user, 2026-11-18). Nothing sets that column today, so this stays dormant until something does. In `userRouter.acceptInvitation`, after person-linking, if `invitation.teamId` names an Active team in that org, grant the accepting user access. Like person-linking, it never fails the accept: it's wrapped in try/catch with `console.error`, and it's skipped silently when the team is missing, archived or deleted, or the grant already exists. It uses the same hand-built `OrgServiceContext` the person-linking block builds, hoisted so both share it.

## Tasks

### Review group A: team slugs (data)

- [x] **Task 1: `Team.slug` column and `TeamSlug` schema**
  - **Files:** `prisma/schema.prisma`, `prisma/migrations/<ts>_add_team_slug/`, `src/lib/schemas/team.ts`, `src/lib/schemas/team.test.ts` (new)
  - **Do:** Add `slug String? @unique` to `Team`. Run `npm run prisma migrate dev -- --name add_team_slug` against the branch DB (ask first; `db:branch` is already done). In `team.ts`, add `TEAM_SLUG_RESERVED` and `TeamSlug = { schema }` per Decisions. In the **read** schema `teamSchema`, `slug` is a plain `z.string().nullable()`, so a word added to the reserved list later can't make existing rows fail `fromRecord` or `updateTeam`'s `modifiableSchema.parse(existingTeam)`. `modifiableSchema` picks `slug` and overrides it with the validating input: `z.union([z.literal("").transform(() => null), TeamSlug.schema]).nullable()` or equivalent. Don't use a bare `z.preprocess`: its Zod 4 input type is `unknown`, which breaks the typed `<Input {...field}>` binding. Update any test fixtures or `TeamData` literals that now fail to typecheck (`slug: null`).
  - **Done when:** the migration SQL is one `ALTER TABLE "teams" ADD COLUMN "slug" TEXT` plus a unique index. Tests cover valid slugs, bad characters, too short and too long, each reserved word, and `""` → `null`. `npm run check` passes.

- [x] **Task 2: create and update a team's slug**
  - **Files:** `src/trpc/routers/teams-router.ts` (where `createTeam` and `updateTeam` live), `src/trpc/routers/teams-router.test.ts`, `src/server/services/teams.ts`, `src/server/services/teams.test.ts`
  - **Do:** Add `Teams.getBySlug(prisma, slug)`, which takes `prisma` rather than an org ctx (like `UserAccounts.listDeleted(prisma)`) because it looks across **all** orgs, and #524's `teamProcedure` will have no org ctx. It returns `{ id, organizationId } | null`. Also map a P2002 on `slug` (`isUniqueViolation`, `src/server/prisma-errors.ts`) to the same `FieldConflictError`, so a race gives a field error rather than a 500. In `createTeam`, write `slug: create.slug`. In both `createTeam` and `updateTeam`, when the slug is non-null and held by a different team, throw `FieldConflictError("slug", \`The slug "${slug}" is already taken.\`)`before the transaction, the way`organization-groups-router.ts`does. The message must not name the other team or its org.`updateTeam`already spreads`update`and diffs it, so the slug change is logged. But`updateTeam`builds the diff's "before" with`TeamData.modifiableSchema.parse(existingTeam)` (`teams-router.ts:721`), which re-validates the stored slug and would throw if that slug later became a reserved word. Build the "before" object without validating the slug, for example by picking the fields off `existingTeam` directly.
  - **Done when:** router tests cover: create with a slug; create with a taken slug (the holder is in another org) → conflict on `slug`; update to the team's own current slug → no conflict; update to `null` clears it and logs the change; update to a slug held by a team in another org → conflict. `npm run check` passes.

### Review group B: access grants (data)

- [x] **Task 3: `TeamUser` model**
  - **Files:** `prisma/schema.prisma`, `prisma/migrations/<ts>_add_team_users/`, `src/lib/schemas/team-user.ts` (new), `src/lib/schemas/log-entry.ts`, `src/server/services/user-accounts.ts`, `src/trpc/routers/organizations-router.ts`, `src/trpc/routers/user-router.ts` and their tests
  - **Do:** Add `TeamUser` per Decisions, including the direct `user` relation, with back-relations on `Team`, `OrganizationUser` and `User` (all `teamUsers`). Add the explicit cleanup from Decisions to purge, `removeOrganizationMember` and `leaveOrganization`. Run `npm run prisma migrate dev -- --name add_team_users` (ask first). Add `TeamUserId` (`create()` via `nanoId16`) and a `TeamUserData` read shape for the list rows: `{ id, teamId, userId, createdAt, user: { id, name, email, image }, onRoster: boolean }` for a team's grants, and `{ id, team: TeamRef & { slug, status }, createdAt }` for a user's teams. Add `"TeamUser"` to `logObjectTypeValues` and map it to `"org-admin"` in `moduleByObjectType`.
  - **Done when:** the migration creates `team_users` with both FKs (the composite one onto `organization_users ("organizationId", "userId")`, `ON DELETE CASCADE`), the unique index and the index. `npm run check` passes, including `log-entry.test.ts`.

- [x] **Task 4: `team-users` service**
  - **Files:** `src/server/services/team-users.ts` (new), `src/server/services/team-users.test.ts` (new)
  - **Do:** Following `src/server/services/CLAUDE.md` and `docs/patterns/transactional-writes.md`, with `OrgServiceContext` throughout. Never `include` through the composite `organizationUser` relation (see Decisions).
    - `listForTeam(ctx, teamId)`: the team's grants with user details (through `user`), leaving out soft-deleted users, ordered by user name. `onRoster` is true when the user's `OrganizationUser.personId` has an `Active` `TeamMembership` in this team. Throws `NotFoundError` if the team isn't in the org.
    - `listForUser(ctx, userId)`: the user's grants in this org with team ref, slug and status, ordered by team name.
    - `grant(ctx, teamId, userId)`: requires an Active team in the org (`NotFoundError` if missing; `ConflictError` "Archived teams can't be granted access." if not Active), an `OrganizationUser` in the org whose user isn't `Deleted` (`NotFoundError`), and no existing grant (`ConflictError`). Creates the row and a `Create` `TeamUser` log entry in one `$transaction`, with `context` refs to `Team` and `User` and a description naming the user and team. Returns the row.
    - `revoke(ctx, teamId, userId)`: `NotFoundError` if no grant. Deletes the row and logs `Delete` `TeamUser` (same refs) in one `$transaction`.
    - `getById` is not needed. Add only what callers use.
  - **Done when:** service tests (prisma-mock, per `.claude/rules/testing.md`) cover each function's happy path and each error, including a team in another org → `NotFoundError`, a soft-deleted user → `NotFoundError`, and `onRoster` true and false. `npm run check` passes.

- [x] **Task 5: `teamUsers` router**
  - **Files:** `src/trpc/routers/team-users-router.ts` (new), `src/trpc/routers/team-users-router.test.ts` (new), `src/trpc/routers/_app.ts`, `src/client/team-users-effects.ts` (new), `src/client/teams-effects.ts`, and the effects file for `removeOrganizationMember`
  - **Do:** Procedures in alphabetical order, each a thin call into `TeamUsers.*`:
    - `grantTeamAccess`: `organizationProcedure({ member: ["update"] })`, `{ teamId, userId }`
    - `listTeamUsers`: `member: ["view"]`, `{ teamId }`
    - `listUserTeams`: `member: ["view"]`, `{ userId }`
    - `revokeTeamAccess`: `member: ["update"]`, `{ teamId, userId }`

    Register the router as `teamUsers` in `_app.ts`. Effects go in a new client file, `src/client/team-users-effects.ts`, built with `createEffects<"teamUsers">()({…})` like `src/client/teams-effects.ts`: grant and revoke invalidate both lists. Also add `teamUsers.listUserTeams` to `teamsEffects`' update, archive, restore and delete effects, since that list shows slug and status, and both `teamUsers` lists to `removeOrganizationMember`'s effects.

  - **Done when:** router tests show that a `member`-role caller (no `member: ["update"]`) is refused for grant and revoke, that an admin can grant and revoke, and that domain errors map to `NOT_FOUND`/`CONFLICT`. `npm run check` passes.

- [x] **Task 6: honour `OrganizationInvitation.teamId` on accept**
  - **Files:** `src/trpc/routers/user-router.ts`, `src/trpc/routers/user-router.test.ts`
  - **Do:** Per Decisions. `findOwnPendingInvitation` already returns `teamId`, and better-auth ignores it with teams disabled. Hoist the `orgCtx` the person-linking block builds, then after person-linking, in its own try/catch: if `invitation.teamId` parses with `TeamId.schema.safeParse` (better-auth could store several comma-joined; skip if it doesn't parse), call `TeamUsers.grant(orgCtx, teamId, ctx.userId)`. The test must seed the `OrganizationUser`, because `acceptInvitationMock` doesn't create it. Catch `NotFoundError`/`ConflictError` quietly (a missing, archived or already-granted team is skipped), and `console.error` anything else. The accept still succeeds either way.
  - **Done when:** tests cover: an invitation with no `teamId` creates no grant; an invitation with an Active team's `teamId` creates a grant and its log entry; an archived team's `teamId` skips the grant and still accepts; a grant that throws unexpectedly still returns `organizationSlug`. `npm run check` passes.

### Review group C: admin UI (visual)

- [x] **Task 7: slug in the team dialogs and details** · `visual` · `mechanical`
  - **Files:** `src/modules/org-admin/components/teams/create-team.tsx`, `update-team.tsx`, `team-content.tsx`, `teams-list.tsx`
  - **Do:** Add an optional **Slug** field to the Create Team and Update Team forms, with a description like "Optional. Unique across AVUT. Setting one gives the team its own space; leave it blank to keep it off." Map the router's `FieldConflictError` on `slug` to the field, which both dialogs already do (`error.data.conflict.fieldName`). The update dialog uses `defaultValues: team` and `form.reset(team)`, so map `slug: null` to `""` there. The create dialog's `defaultValues` have no `slug`, and `modifiableSchema` rejects `undefined`, so until it's added the create form fails validation silently. Add `slug: ""` to them. Show the slug in the Team Details card (monospace, or "None" muted). Add a **Slug** column to the teams list, hidden by default if the table supports column visibility, otherwise shown.
  - **Done when:** a slug can be set, changed and cleared from the dialog. A taken slug shows the error on the field. `npm run check` passes. Visual check below.

- [x] **Task 8: Team access card on a team's admin page** · `visual`
  - **Files:** `src/modules/org-admin/components/teams/team-access-card.tsx` (new), `grant-team-access.tsx` (new), `revoke-team-access.tsx` (new), `team-content.tsx`, `src/app/(wrapper)/(authenticated)/orgs/[slug]/admin/teams/[team_id]/page.tsx` (prefetch `teamUsers.listTeamUsers`, per `docs/patterns/detail-page-data-fetching.md`), `content/help/admin/teams.mdx`
  - **Do:** A card in the main column below Team Details, titled **Access**: the users granted access, each with name, email and an "On roster" badge when `onRoster`, and a revoke action. The card shows behind `<Protect permissions={{ member: ["view"] }}>` and the grant and revoke controls behind `member: ["update"]` (see `docs/patterns/protect-permission-gating.md`). The grant dialog follows `docs/patterns/mutation-dialog.md` (`?action=grant-access`): pick from `organizations.listMembers`, minus users already granted, and submit `grantTeamAccess`. The revoke dialog is a confirm dialog (`?action=revoke-access&user=<id>` or the pattern doc's equivalent for a row action). Use `UserLink` from `src/components/entity-links/` for names. An empty state reads "No one has access to this team yet." Update the `admin/teams` help card with a short paragraph on slugs and access grants.
  - **Done when:** an admin can grant and revoke from the card, both lists refresh through the mutation effects, and a `member`-only user sees no card. `npm run check` passes.

- [x] **Task 9: a user's teams on their admin page** · `visual` · `mechanical`
  - **Files:** `src/modules/org-admin/components/users/user-content.tsx`, `src/modules/org-admin/components/users/user-teams-card.tsx` (new), `src/app/(wrapper)/(authenticated)/orgs/[slug]/admin/users/[user_id]/page.tsx` (prefetch `teamUsers.listUserTeams`, per `docs/patterns/detail-page-data-fetching.md`), `content/help/admin/users.mdx`
  - **Do:** A read-only **Teams** card on `orgs/[slug]/admin/users/[user_id]`, listing `teamUsers.listUserTeams` with `TeamLink`s and a status badge for non-Active teams. The empty state reads "No team access." It's behind `member: ["view"]`. Add a line to the `admin/users` help card saying team access is granted from each team's page.
  - **Done when:** the card lists the grants made in Task 8. `npm run check` passes.

Visual checkpoint after Task 9: on the worktree's dev server, open a team's admin page (set and clear a slug, try a taken one, grant and revoke access), then the granted user's admin page.

## Docs impact

Admin → Teams gains a Slug field and an Access card, and Admin → Users gains a Teams card. Guides likely touched: the admin teams and users pages under `content/docs/`. Screenshots that would change: the team detail page and the user detail page.

## Out of scope

- Any `/teams/[slug]` route, `teamProcedure`, team scope or `ScopeSwitcher` entry (#524), and team-scope management of grants (#525).
- Slug redirects or slug history.
- Anything that **sets** `OrganizationInvitation.teamId` (inviting to a team). Only acceptance honours it here.
- Logging the grants removed when a member leaves or is removed from the org, when a user is purged, or when a team is purged from the Rubbish bin.
- Bulk grant ("grant everyone on the roster").

## Parked

- Make the Access card on a team's admin page match the look of the team members card (Related → Personnel). The user raised this at the visual checkpoint on 2026-11-18: the card works for now and can be harmonised later. Filed as #535.

## Review notes

- [x] (Group A, Task 2) `updateTeam`'s input still runs `TeamSlug.schema`, so a team whose stored slug later becomes reserved can't take a name-only edit: the resent slug fails validation. Accept an unchanged stored slug. For example, `modifiableSchema` validates only the slug's shape (characters and length), and the router (plus the dialog, for the error message) checks reserved words only when the slug changes. Extend the "since become reserved" test to cover a name-only edit.
- [x] (Group B, Task 4) `TeamUsers.listForUser` leaves out teams with status `Deleted` (in the Rubbish bin). Archived teams stay, and Task 9 shows them with a badge.
- [x] (Group B, Task 5) Add `recoverTeam` to the `teamsEffects` that invalidate `teamUsers.listUserTeams`, since `listForUser` hides Deleted teams.
- [x] (Group B, Task 5) The `onRoster` badge goes stale: `teamsEffects` `createTeamMembership`/`deleteTeamMembership`/`recoverTeamMembership` should invalidate `teamUsers.listTeamUsers` for that team, and `usersEffects` `linkPerson`/`unlinkPerson` should invalidate it org-wide.
- [x] (Group B, Task 4) `TeamUsers.grant` races: map a P2002 (`isUniqueViolation`) from its `$transaction` to the same duplicate-grant `ConflictError`. Also reword the non-Active error to "Only active teams can be granted access."
- [x] (Group C, Task 8) Add `teamUsers.listGrantableUsers` (org-wide) to the effects of `removeOrganizationMember`, and of user delete and recover, where those have effects.
- [x] (Group C, Task 8) The team page prefetches `teamUsers.listTeamUsers` for every viewer, but a viewer without `member: ["view"]` gets FORBIDDEN on every visit. Prefetch it only when the caller holds `member: ["view"]`.
- [x] (Group C, Task 8) Revoke's `returnFocusRef` is the grant button, which isn't rendered on an archived team. Give the card a focus target that's always mounted (e.g. the `CardTitle` with `tabIndex={-1}`). Also give the grant picker a "Select a user." error in place of Zod's raw message.
