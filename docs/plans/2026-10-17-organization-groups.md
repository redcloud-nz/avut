# Implementation plan: Organization Groups (v1 — the fabric)

**Date:** 2026-10-17
**Tracks:** [#382](https://github.com/redcloud-nz/avut/issues/382) (brainstorm:
redcloud-nz/avut-ideas#31)
**Written against:** integration @ 12d0c8d1 (first written 2026-09-29 against cef534bd; revised at
pickup for the modules refactor and other drift)
**Branch:** `feat/organization-groups` (was `plan/organization-groups`), worktree
`.claude/worktrees/organization-groups`, dev server on its `.dev-port` (3106).
**DB:** Task 1 adds a Prisma migration (additive: two tables, two enums, one FK on an existing
nullable column). The worktree is **not yet `db:branch`ed** — `.env.local` still points at
`avut`, which is right until Task 1. Run `npm run db:branch organization-groups` before the first
`prisma migrate dev` — never draft it against shared `avut`. `migrate dev` itself still needs
permission.
**Not touched:** `src/lib/modules.ts` (groups are sub-pages of the existing `system-admin`
module), `src/lib/permissions.ts` / `<Protect>` (everything is `systemAdminProcedure` and
system-admin-only UI), D4H (no token dependency; only the credential FK changes).

v1 builds the **group fabric only**: a first-class `OrganizationGroup` entity, an
`OrganizationGroupMembership` join table with a role and a status, and system-admin screens to
create groups and manage their members. The link grants nothing yet — no capability (skill
rollup, drive sharing) consumes it. Each capability gets its own spec later, built on this.

---

## Current state (checked on `12d0c8d1`)

- `Organization` (`prisma/schema.prisma:114`) has `id`, `name`, `slug` (unique), `logo?`,
  `createdAt`, `metadata?`, and back-relations for everything it owns. Nothing links one
  organization to another.
- `ProviderCredential.groupId` (`prisma/schema.prisma:410-412`) is a plain nullable `String?`,
  indexed, with a doc comment saying it is "unused until OrganizationGroup (#198) exists. No FK
  yet … because #284 already commits to group-owned credentials being real". Both issue numbers
  are stale: #198 is now avut-ideas#31 / avut#382, and #284 is now avut-ideas#18. Nothing writes
  `groupId`. The only reader is the guard in `src/server/provider-credential.ts:78` (a
  group-owned credential never comes back from an organization lookup).
  `src/server/provider-credential.test.ts` seeds a group credential with `groupId: nanoId16()` in
  **both** `describe` blocks (line 89, `getOrganizationProviderCredential`; line 196,
  `getProviderCredentialForOwner`) — a group that doesn't exist, which prisma-mock allows because
  it doesn't enforce FKs.
- System-admin procedures use `systemAdminProcedure` (`src/trpc/init.ts:210`), whose
  `ctx.logEvent` takes exactly one of `organizationId` / `ownerId` / `scope: "system"`
  (`src/trpc/CLAUDE.md` → "Audit logging").
- `src/server/services/service-context.ts` declares `UserServiceContext` (`logEvent`) and
  `OrgServiceContext` (`UserServiceContext & { organizationId }`). `SystemServiceContext`
  (`{ prisma, logSystemEvent }`) is still declared locally in
  `src/server/services/user-accounts.ts:31`. `users-router.ts:30` builds it with a private
  `systemServiceContext(ctx: SystemAdminContext)` helper; `user-router.ts` builds
  `logSystemEvent` inline (lines 226, 562) without naming the type. `user-accounts.test.ts:32`
  is the example of building one in a service test.
- `src/server/prisma-errors.ts` exists (`server-only`) and holds `isPrismaRecordNotFound` (P2025),
  duck-typed on `code`. `isUniqueViolation` is still a private helper in
  `src/trpc/routers/organizations-router.ts:76`.
- Domain errors (`src/lib/errors.ts`): `NotFoundError`, `ForbiddenError`, `ConflictError`,
  `ValidationError`, `PreconditionError`, … all mapped in `init.ts`. `FieldConflictError` is in
  `src/trpc/errors.ts`; `personnel-router.ts:63` is the router pre-check precedent.
- Log vocabulary (`src/lib/schemas/log-entry.ts`): `LogAction` already has `Create`, `Update`,
  `Delete`, `Revoke`. `LogObjectType` is a closed list and `moduleByObjectType` must map every
  value (the `Record<LogObjectType, …>` type enforces it). The object-history feature
  (`object-history.ts`, `diff-format.ts`) uses only `Partial` maps and org-scoped reads, so
  nothing else needs an entry for the new types.
- System-admin UI lives in `src/modules/system-admin/components/` since the modules refactor.
  Org screens to mirror: list at
  `src/app/(wrapper)/(authenticated)/system/admin/organizations/page.tsx` +
  `src/modules/system-admin/components/organizations/organizations-list.tsx` (Kaga table,
  `SystemAdmin_CreateOrganization_Dialog` in `create-organization-dialog.tsx`); detail at
  `…/organizations/[organizationId]/page.tsx` + `organization-content.tsx` (Saratoga columns,
  Identity / Members / Teams cards with plain tables, `SystemAdmin_AddMember_Dialog` using
  `SearchableSelect`, `SystemAdmin_MemberActionsMenu`). Cache effects live in
  `src/client/organizations-effects.ts` (`createEffects<"organizations">()`); effects get
  `(vars, data)` (`src/trpc/mutation-effector.tsx`). `organizations.listOrganizations` returns
  `{ organizations: [...] }`.
- System-admin navigation: `src/modules/system-admin/components/sidebar-menu.tsx` (sub-items:
  Organisations, Users, Skill Packages, Rubbish, …) and the index page
  `src/app/(wrapper)/(authenticated)/system/admin/page.tsx` (an `ItemGroup` of links).
- Organization id/data schemas: `src/lib/schemas/organization.ts` (`OrganizationId`,
  `OrganizationData.createSchema` — slug `^[a-z0-9-]+$`, 2–50 chars; `OrganizationRef` whose
  `name` is `min(5)`). There is no `OrganizationLink`.
- `src/trpc/routers/_app.ts` registers routers alphabetically; `organizationGroups` goes after
  `notifications` and before `organizationNotes`.
- The only `Organization` hard delete is `prisma/seed-demo.ts:243`, which re-creates the demo org.

## Decisions

Settled with the user before planning (2026-09-29):

1. **v1 is the fabric only.** Models + system-admin CRUD for groups and memberships. No
   `OrganizationGroupConfig` table and no capability switches or consent toggles — those arrive
   with the first capability that reads them, so the settings schema isn't designed blind.
2. **No org-facing UI.** Groups are visible only under `/system/admin`: a groups list, a group
   detail page, and a read-only "Groups" card on the system-admin organization detail page.
3. **Audit log in `scope: "system"`.** Only system admins act in v1. Every membership entry
   carries a `refs` entry naming the affected organization with `role: "context"` so the fan-out
   index ties it to that org. Revisit (fourth scope, or org feed) when org-facing flows land.
4. **At most one active overseer per group**, enforced in the service, not by a DB constraint —
   allowing several later is a code change, not a migration. The check counts only
   `status: Active` rows, so a revoked row that kept `role: Overseer` neither blocks a new
   overseer nor shows as the current one (`listGroups` filters the same way). A group may have
   none (e.g. just created). Making a second org overseer while one is active throws
   `ConflictError`; the admin demotes the current one first. The check-then-write race is
   accepted: only system admins write, and a violation is visible and fixable in the UI.

Settled by reading the code (not user decisions, but worth recording):

5. **Membership shape.** `OrganizationGroupMembership` has its own `id` (log `objectId`),
   `@@unique([groupId, organizationId])`, `role` and `status` as Prisma enums in PascalCase
   like `RecordStatus`: `OrganizationGroupRole { Overseer Member }`,
   `OrganizationGroupMembershipStatus { Invited Active Revoked }`. `Invited` is reserved for the
   later invite→accept flow and is never written in v1 — mark it DORMANT in a schema comment.
   Both FKs `onDelete: Cascade`. Side effect: `seed-demo.ts`'s demo-org re-create silently drops
   that org's memberships with no log entry — acceptable for demo data.
6. **Revoke keeps the row.** Revoking sets `status: Revoked` (history survives). Adding an org
   whose membership is `Revoked` reactivates that same row (`status: Active`, the given role) and
   logs `Update` with the diff, rather than creating a second row.
7. **Group identity mirrors `Organization`**: `id`, `name`, `slug` (`@unique`), `logo String?`,
   `createdAt`, `updatedAt`. No `RecordStatus` — no archive, no Rubbish bin in v1.
8. **Delete is a hard delete, blocked while any membership is `Active`** (`ConflictError`,
   "Revoke its members first"). Revoked rows cascade with the group. The log entry is
   `scope: "system"` and denormalizes the group's name and slug into `description`, since the
   subject is gone.
9. **`ProviderCredential.groupId` gets its FK now** (`onDelete: Cascade`, like
   `organizationId`) in the same migration, and its "no FK yet" comment is updated (and its stale
   issue numbers replaced with avut#382 and redcloud-nz/avut-ideas#18). Nothing writes it, so
   every existing value is null and the constraint is safe to add. When group-owned credentials
   become real (avut-ideas#18), `deleteGroup` must also refuse while the group owns credentials —
   leave a `TODO(avut-ideas#18)` comment at that guard.
10. **One service, system-scoped.** `src/server/services/organization-groups.ts` takes
    `SystemServiceContext`, which moves out of `user-accounts.ts` into `service-context.ts` so two
    services share it. The router-side builder moves with it into a shared `src/trpc/` helper.
11. **Log vocabulary:** new object types `OrganizationGroup` and `OrganizationGroupMembership`,
    both attributed to module `"system-admin"`. Actions: group `Create`/`Update`/`Delete`;
    membership `Create` (add), `Update` (role change, reactivation), `Revoke`.
12. **Routes:** `/system/admin/groups` and `/system/admin/groups/[groupId]`, matching
    `organizations/[organizationId]`.
13. **Slug conflicts** follow the personnel precedent (`personnel-router.ts:63`): the service
    exports `getGroupBySlug`; the router pre-checks it and throws `FieldConflictError` on `slug`.
    The service still guards itself (pre-check + unique-violation mapping → `ConflictError`) for
    the race and for non-router callers. On update, both pre-checks ignore a match whose
    `id === groupId`, so saving a name change with the slug unchanged is not a conflict.
14. **Mutation return shapes carry what cache effects need.** Membership mutations return
    `{ id, groupId, organizationId }`; `createGroup` returns `{ id, slug }`; `updateGroup` and
    `deleteGroup` return `{ id }`. Effects read ids from `data`, since `setMemberRole` /
    `revokeMember` inputs carry only a `membershipId`.
15. **Table headings** follow the admin-table convention: membership status is headed
    "Membership", never a bare "Status" (that means `RecordStatus`). No "Since"/"Added" date
    column — a reactivated row keeps its original `createdAt` and a role change bumps
    `updatedAt`, so neither means "member since".
16. **Wrong-state membership writes** throw `ConflictError`: `setMemberRole` or `revokeMember` on
    a non-`Active` row, and `addMember` on an `Active` one. `setMemberRole` to the role the row
    already has is a no-op: no write, no log entry, same return shape.
17. **Ref names follow the create bounds.** `OrganizationGroupRef` uses the `createSchema` name
    bounds (min 2, max 100), not `OrganizationRef`'s `min(5)`. Service results carrying an
    organization (overseer, member rows) return plain `{ id, name, slug }` objects and are not
    parsed through `OrganizationRef.schema`, which would throw on orgs with 2–4 character names.
18. **Route access:** the procedure is the check (`docs/patterns/route-access-control.md`). The
    new pages call no `requireSystemAdmin()` in `generateMetadata` and rely on `fetchQuery` →
    `forbidden()`. The page bodies keep the existing system-admin pages' `requireSystemAdmin()`
    call, mirroring the accepted pattern there.

## Tasks

Review groups: **A** = Tasks 1–2 (schema + vocabulary), **B** = Tasks 3–5 (service + router),
**C** = Tasks 6–9 (UI, `visual`, one checkpoint after Task 9).

### Group A — schema and vocabulary

- [x] **1. Schema, migration and id/data schemas** — `feat(organization-groups): add group and membership schema`
  - **Files:** `prisma/schema.prisma`, `prisma/migrations/<timestamp>_organization_groups/`,
    `src/lib/schemas/organization-group.ts` (new), `src/lib/schemas/organization-group.test.ts`
    (new), `src/server/provider-credential.test.ts`.
  - **Do:** Add models `OrganizationGroup` (`@@map("organization_groups")`) and
    `OrganizationGroupMembership` (`@@map("organization_group_memberships")`, `@@index` on both
    FKs) and the two enums, per decisions 5 and 7. Add the back-relation on `Organization`
    (`groupMemberships`), and turn `ProviderCredential.groupId` into a relation to
    `OrganizationGroup` (decision 9) with a back-relation `providerCredentials` on the group;
    rewrite its doc comment. Use named relations in the existing `"<child>_to_<parent>"` style.
    Run `npm run db:branch organization-groups` (stop your dev server first; ask the user to stop
    theirs and Prisma Studio), then **ask permission** and run
    `npm run prisma migrate dev --name organization_groups`. In
    `src/lib/schemas/organization-group.ts` add `OrganizationGroupId` and
    `OrganizationGroupMembershipId` (the branded `zodNanoId16` + `create()` shape from
    `organization.ts`), `OrganizationGroupData` (`schema`, `createSchema` reusing the org slug
    rule, `updateSchema`), `OrganizationGroupRole` / `OrganizationGroupMembershipStatus` value
    schemas with display labels, and an `OrganizationGroupRef` (`{ id, name }`, decision 17). In
    `provider-credential.test.ts`, seed a real `OrganizationGroup` in **both** `describe` blocks'
    `beforeAll`s, point each group credential's `groupId` at it (via
    `OrganizationGroupId.create()`), and drop the then-unused `nanoId16` import.
  - **Done when:** the migration SQL is additive only (two `CREATE TABLE`, two `CREATE TYPE`, FK
    adds, one FK on `provider_credentials.groupId`); `npx prisma migrate status` is clean on the
    branch DB; schema tests cover slug validation, a 2-character group name passing `Ref`, and
    `create()` producing a valid id; neither `provider-credential.test.ts` `describe` uses a
    random `groupId` (prisma-mock won't catch a missed one); `npm run check` passes.

- [x] **2. Log vocabulary and shared system-service context** — `feat(organization-groups): add group log vocabulary and shared system service context`
  - **Files:** `src/lib/schemas/log-entry.ts`, `src/lib/schemas/log-entry.test.ts`,
    `src/server/services/service-context.ts`, `src/server/services/user-accounts.ts`,
    `src/server/services/user-accounts.test.ts` (import only), `src/trpc/system-service-context.ts`
    (new), `src/trpc/routers/users-router.ts`, `src/server/services/CLAUDE.md`.
  - **Do:** Add `OrganizationGroup` and `OrganizationGroupMembership` to `logObjectTypeValues`
    and map both to `"system-admin"` in `moduleByObjectType` (decision 11). Move the
    `SystemServiceContext` interface (with its doc comment) into `service-context.ts` and import
    it in `user-accounts.ts` and its test. Move `users-router.ts`'s private
    `systemServiceContext(ctx: SystemAdminContext)` into `src/trpc/system-service-context.ts`
    (it needs `SystemAdminContext`, so it can't live in `service-context.ts`) and import it back.
    Leave `user-router.ts`'s inline builders alone. In `src/server/services/CLAUDE.md`, add a
    bullet next to the Org/User context bullets: a system-scoped service (`user-accounts.ts`,
    `organization-groups.ts`) takes `SystemServiceContext` (`{ prisma, logSystemEvent }`), built
    in a router with `systemServiceContext(ctx)` from `src/trpc/system-service-context.ts`; it
    deliberately does not satisfy `UserServiceContext`, so it can't be passed to a user/org
    service or to `withBatch`. No behaviour change.
  - **Done when:** `objectTypesForModule("system-admin")` returns the two new types (new case in
    `log-entry.test.ts`); `npm run check` passes with `user-accounts` behaviour unchanged.

### Group B — service and router

Both service tasks follow `src/server/services/CLAUDE.md` (namespace import, `require*ById`
naming, domain errors from `src/lib/errors.ts`, no `TRPCError`) and pair every write with
`ctx.logSystemEvent` inside `ctx.prisma.$transaction([...])` per
`docs/patterns/transactional-writes.md`. Tests use prisma-mock with one shared `beforeAll`
dataset per `describe` (`.claude/rules/testing.md`) and build the context as
`user-accounts.test.ts:32` does.

- [x] **3. `OrganizationGroups` service: groups** — `feat(organization-groups): add organization groups service for groups`
  - **Files:** `src/server/services/organization-groups.ts` (new),
    `src/server/services/organization-groups.test.ts` (new), `src/server/prisma-errors.ts`,
    `src/trpc/routers/organizations-router.ts` (import only).
  - **Do:** Move `isUniqueViolation` from `organizations-router.ts:76` into the existing
    `src/server/prisma-errors.ts`, next to `isPrismaRecordNotFound` and in the same duck-typed
    shape (with a doc comment), and import it back in the router. Implement:
    - `requireGroupById(ctx, groupId)`, `getGroupBySlug(ctx, slug)` (decision 13)
    - `listGroups(ctx)` — each group with active member count and its active overseer's
      org `{ id, name, slug }` (or null) (decisions 4, 17)
    - `getGroupDetail(ctx, groupId)` — the group plus all memberships (any status) with each
      org's `{ id, name, slug }`, role, status
    - `createGroup(ctx, { name, slug })` — `ConflictError` on a taken slug (pre-check, then map
      a unique violation, as `createOrganization` does). Logs `Create`
    - `updateGroup(ctx, { groupId, name, slug })` — `diffObject`-based `changes`; slug conflict
      as above, ignoring the group's own slug (decision 13); logs `Update`
    - `deleteGroup(ctx, groupId)` — decisions 8 and 9 (with the `TODO(avut-ideas#18)`)
      Return shapes per decision 14.
  - **Done when:** tests cover: create + slug conflict; update diff; update keeping its own slug
    → no conflict; delete blocked with an active member and allowed with only revoked ones
    (revoked rows gone after; seed the memberships directly); `listGroups` overseer/count ignore
    revoked rows; each write produces exactly one `scope: "system"` log entry with the expected
    action. `npm run check` passes.

- [x] **4. `OrganizationGroups` service: memberships** — `feat(organization-groups): add organization group membership service`
  - **Files:** `src/server/services/organization-groups.ts`,
    `src/server/services/organization-groups.test.ts`.
  - **Do:** Implement:
    - `requireMembershipById(ctx, membershipId)`
    - `listGroupsForOrganization(ctx, organizationId)` — that org's memberships (any status)
      with the group ref, role, status
    - `addMember(ctx, { groupId, organizationId, role })` — decision 4 (overseer check) and 6
      (reactivate a revoked row); `ConflictError` if already `Active` (decision 16), and map a
      unique violation on `@@unique([groupId, organizationId])` to `ConflictError` for the race;
      logs `Create` or `Update`
    - `setMemberRole(ctx, { membershipId, role })` — overseer check; only on `Active` rows;
      same-role no-op (decision 16); logs `Update` with the role diff
    - `revokeMember(ctx, membershipId)` — `Active` → `Revoked`; logs `Revoke`
      Return shapes per decision 14. Every membership entry refs the organization
      (`objectType: "Organization"`, `role: "context"`) and the group
      (`objectType: "OrganizationGroup"`, `role: "context"`). Put the group and org names in
      `description` so a system-feed entry reads on its own.
  - **Done when:** tests cover: add member; add when already active → conflict; second overseer
    → conflict (via add and via `setMemberRole`); a revoked overseer doesn't block a new one;
    demote-then-promote succeeds; same-role `setMemberRole` writes no log; revoke / role change
    on a revoked row → conflict; revoke then re-add reuses the row id; each write produces
    exactly one `scope: "system"` log entry with the expected action and org ref.
    `npm run check` passes.

- [x] **5. `organizationGroups` tRPC router and cache effects** — `feat(organization-groups): add organization groups router and cache effects`
  - **Files:** `src/trpc/routers/organization-groups-router.ts` (new),
    `src/trpc/routers/organization-groups-router.test.ts` (new), `src/trpc/routers/_app.ts`,
    `src/client/organization-groups-effects.ts` (new).
  - **Do:** A thin router over the service, every procedure `systemAdminProcedure`, in
    alphabetical order (`src/trpc/CLAUDE.md`): `addMember`, `createGroup`, `deleteGroup`,
    `getGroup`, `listGroups`, `listGroupsForOrganization`, `revokeMember`, `setMemberRole`,
    `updateGroup`. Build the service context with the task-2 `systemServiceContext(ctx)`. Inputs
    use the task-1 schemas. `createGroup`/`updateGroup` pre-check `getGroupBySlug` and throw
    `FieldConflictError` on `slug` (decision 13; on update, ignore the group's own id). Register
    as `organizationGroups` in `_app.ts` (after `notifications`, before `organizationNotes`).
    Write `organization-groups-effects.ts` in the `createEffects<"organizationGroups">()` shape
    of `organizations-effects.ts`, reading ids from `data` (decision 14): group writes invalidate
    `listGroups` and that group's `getGroup`; membership writes also invalidate `listGroups`,
    `getGroup` for `data.groupId`, and `listGroupsForOrganization` for `data.organizationId`;
    `deleteGroup` invalidates all `listGroupsForOrganization`.
  - **Done when:** router tests show a non-admin caller gets `FORBIDDEN` on a query and a
    mutation, an admin round-trip (create → add member → get) works, a duplicate slug surfaces
    as a `FieldConflictError` on `slug`, and an update that keeps its own slug succeeds.
    `npm run check` passes.

### Group C — UI (`visual`)

- [x] **6. Groups list page and group entity link** `visual` `mechanical` — `feat(organization-groups): add groups list page and group entity link`
  - **Files:** `src/app/(wrapper)/(authenticated)/system/admin/groups/page.tsx` (new),
    `src/modules/system-admin/components/groups/groups-list.tsx` (new),
    `src/modules/system-admin/components/groups/create-group-dialog.tsx` (new),
    `src/components/entity-links/organization-group-link.tsx` (new),
    `docs/patterns/entity-link.md` (wrapper table row),
    `src/modules/system-admin/components/sidebar-menu.tsx`,
    `src/app/(wrapper)/(authenticated)/system/admin/page.tsx`.
  - **Do:** Add `OrganizationGroupLink` per `docs/patterns/entity-link.md` → "Adding a new entity
    type" (props intersect `OrganizationGroupRef`, href to `/system/admin/groups/[groupId]` via
    `route()`), and add its row to the pattern doc's wrapper table. Mirror the organizations list
    page and `organizations-list.tsx`: `requireSystemAdmin` in the page body (decision 18),
    `prefetch` + `HydrateClient`, Kaga table with columns Name (`OrganizationGroupLink`), Slug,
    Overseer (org name, or "—"), Members (active count), Created. Create dialog per
    `docs/patterns/mutation-dialog.md` Recipe A (`?action=create-group`), name + slug, shaped like
    `create-organization-dialog.tsx`, navigating to the new group on success with
    `meta: { effects: …, navigates: true }`. Add a "Groups" sub-item to the sidebar after
    "Organisations", and a matching `Item` on the system-admin index page ("Bind organisations
    together as groups."). Run `npx next typegen` after adding the page.
  - **Done when:** the page renders for a system admin with an empty and a non-empty list; the
    create dialog creates a group, lands on its page and shows a slug conflict inline;
    `npm run check` passes.

- [x] **7. Group detail page: identity, edit, delete** `visual` `mechanical` — `feat(organization-groups): add group detail page with edit and delete`
  - **Files:** `src/app/(wrapper)/(authenticated)/system/admin/groups/[groupId]/page.tsx` (new),
    `src/modules/system-admin/components/groups/group-content.tsx` (new),
    `src/modules/system-admin/components/groups/edit-group-dialog.tsx` (new),
    `src/modules/system-admin/components/groups/delete-group-dialog.tsx` (new).
  - **Do:** Follow `docs/patterns/detail-page-data-fetching.md` (`generateMetadata` via
    `fetchQuery` with no `requireSystemAdmin()` there, page `prefetch` + `useSuspenseQuery` in the
    content) and `docs/patterns/route-access-control.md` (decision 18), and lay it out like
    `organization-content.tsx`: breadcrumbs System Admin › Groups › name; an Identity card (id,
    name, slug, created). Header actions: Edit (`docs/patterns/mutation-dialog.md` Recipe A,
    `?action=edit`, slug conflict inline) and Delete (an `AlertDialog` delete per the pattern
    doc, `navigates: true`, back to the list on success; the service's "revoke its members
    first" conflict shows in the dialog). Run `npx next typegen` after adding the page.
  - **Done when:** edit (including a name-only edit) and delete work from the page and refresh
    through the task-5 effects with no manual cache calls; delete of a group with an active
    member shows the conflict; `npm run check` passes.

- [x] **8. Group detail page: members** `visual` — `feat(organization-groups): add group members card with add, role change and revoke`
  - **Files:** `src/modules/system-admin/components/groups/group-content.tsx`,
    `src/modules/system-admin/components/groups/add-group-member-dialog.tsx` (new),
    `src/modules/system-admin/components/groups/revoke-group-member-dialog.tsx` (new),
    `src/modules/system-admin/components/groups/group-member-actions-menu.tsx` (new).
  - **Do:** Add a Members card with a plain table — Organisation (bare `route()` link to
    `/system/admin/organizations/[organizationId]`, as `organizations-list.tsx` does; there is no
    `OrganizationLink`), Role, Membership (badge; revoked rows muted) per decision 15. "Add
    organisation" dialog (Recipe A, `?action=add-member`): `SearchableSelect` of orgs from
    `organizations.listOrganizations` (as `add-member-dialog.tsx` uses it), excluding active
    members, and a role select. Per-row actions menu: Make overseer / Make member (whichever
    applies; an overseer conflict shows as a toast with the service message); Revoke, a
    nested-entity state-transition confirm per mutation-dialog.md → "Wave-2 dialog kinds"
    (host-owned `?action=revoke-member&membershipId=…`, a plain `Dialog`, reset keyed on the row
    id). The Revoke dialog opens from a `DropdownMenuItem`, so it has no `DialogTrigger`: per
    mutation-dialog.md → "Returning focus without a `DialogTrigger`", put `useReturnFocus`
    (`src/hooks/use-return-focus.ts`) on its `DialogContent` with a `fallbackRef` to the row's
    menu button. Re-add on a revoked row calls `addMember` with role `Member` (re-promote
    afterwards if needed — avoids an overseer conflict).
  - **Done when:** add, role change, revoke and re-add all work and refresh the page through the
    effects; a second overseer shows the conflict toast; focus returns to the row's menu button
    after Revoke closes; `npm run check` passes.

- [ ] **9. Groups card on the system-admin organization page** `visual` `mechanical`
  - **Files:** `src/app/(wrapper)/(authenticated)/system/admin/organizations/[organizationId]/page.tsx`,
    `src/modules/system-admin/components/organizations/organization-content.tsx`.
  - **Do:** Prefetch `organizationGroups.listGroupsForOrganization` on the page and add a
    read-only "Groups" card to the main column after Teams: Group (`OrganizationGroupLink`),
    Role, Membership (decision 15); "Not in any group." when empty. No actions — membership is
    managed from the group page.
  - **Done when:** an org in two groups (one revoked) shows both rows with the right badges;
    `npm run check` passes.

Visual checkpoint after Task 9 (end of group C): sign in as a system admin on the worktree's dev
server, create a group, add two orgs (one overseer), try a second overseer, revoke and re-add,
check both orgs' system-admin pages, then delete the group (blocked until members are revoked).

## Docs impact

None. `content/docs/` and `content/help/` have no system-admin pages.

## Out of scope

- Any capability: skill-reporting rollup, drive/file sharing, or anything else the link would
  grant. Each needs its own spec (the rollup's content and data flow are open questions on
  avut-ideas#31).
- `OrganizationGroupConfig` / group-level switches and per-member consent toggles.
- Org-facing UI of any kind, and the invite → accept flow (`Invited` stays dormant).
- A `group` `LogScope` or org-feed entries for group actions.
- Group logo upload/editing (the column exists; it is never written in v1).
- Group-level permissions in `src/lib/permissions.ts`.
- Writing `ProviderCredential.groupId`, or any code path for group-owned credentials
  (avut-ideas#18).

## Parked

- **History gate for memberships when entries go org-facing.** `OrganizationGroupMembership` is
  in neither `HistoryObjects` nor `RelatedEntryPermissions` (`src/lib/schemas/object-history.ts`).
  Harmless while every group entry is `scope: "system"` (forced `organizationId: null`, so
  `ObjectHistory.list` can't match it), but when decision 3 is revisited and these entries become
  org-scoped or reach an org feed, add a gate for it there.

## Review notes

- `organization-groups.ts` `updateGroup` (Task 3): writes and logs an `Update` with
  `changes: []` when nothing changed. Return `{ id: groupId }` early when `changes.length === 0`
  (as `organization-notes.ts:127` does), plus a test that a no-change update writes no log entry.
- `organization-groups.ts` `deleteGroup` (Task 3): the active-member check runs outside the
  transaction; add a one-line comment at the guard accepting the race, like
  `assertNoActiveOverseer`'s.
- `organization-groups.ts` `getGroupDetail` (Task 3): cast `memberships[].id` to
  `OrganizationGroupMembershipId` as `listGroupsForOrganization` does, so the UI can pass it to
  `setMemberRole`/`revokeMember` without its own cast.
