# Implementation plan: Organization roles reorganisation

**Date:** 2026-09-28

Reworks `src/lib/permissions.ts` and `src/lib/schemas/organization-role.ts` to narrow
admin/owner down to actual admin functions, split ownership out of the general role
picker, flatten the primary/secondary role split into one freely-combinable set, and
rework the `skills-*` permission surface (new `skills-admin`/`skills-reporter` roles,
narrower `skillCheck`/`skillCheckSession` actions, two renames).

**Branch / DB:** no Prisma schema change — `OrganizationUser.role` is already a
free-form comma-joined string; every change here is TypeScript-level (the access
control statement, the role definitions, the stored-role enum). No `db:branch`
needed. The one caveat: renaming the `skill-package-author` role value to
`skills-author` is **not** accompanied by a data migration — AVUT is early enough
that we're assuming no member currently holds it. **Before this ships, manually
verify via Prisma Studio that no `OrganizationUser.role` in the shared dev DB
contains `skill-package-author`** (and check prod once a prod DB exists). If one
turns up, add a one-off `UPDATE` (with permission) rather than silently losing
someone's role.

---

## Decisions folded in (from discussion)

- **Owner is no longer a pickable role.** It's pulled out of the general
  role-assignment schema entirely. `makeOwner`/`removeOwner` are dedicated
  `organizationProcedure({ member: ["owner"] })` mutations; only an existing owner
  holds that permission. `removeOwner` reuses `assertNotLastOwner` and additionally
  **blocks removing your own ownership** — only a different owner can strip yours.
  The "Make owner"/"Remove owner" menu items are **not permission-gated on the menu
  itself** — they always show; `member: ["owner"]` (plus the last-owner/self-removal
  guards) is enforced inside the dialog only. Exposed only from the org-admin Users
  page menu (`AdminModule_User_Menu`), not system-admin, for now.
- **Primary/secondary role split is gone.** One flat, freely-combinable role set:
  `admin`, `member`, `i3-editor`, `skills-assessor`, `skills-admin` (new),
  `skills-author` (renamed), `skills-reporter` (new). `admin` and `member` can be
  held simultaneously or neither — the only invariant is **at least one role**
  (non-empty array). `owner` is excluded from this schema entirely (see above).
- **admin/owner narrowed to actual admin functions.** They keep full CRUD on
  `member`, `invitation`, `organization`, `person`, `team`, plus
  `skillPackageSubscription: ["view"]` (see below) and (owner only)
  `member: ["owner"]`. They get **zero** access to `d4hEquipment`, `i3Item`,
  `i3Template`, `skillCheck`, `skillCheckSession`, `skillPackage` (renamed from
  `skillPackageBuilder`) — an owner/admin who wants to do that work grants
  themselves the relevant specialty role too.
- **`d4hAccessToken` permission resource is removed entirely.** D4H access token
  management re-gates onto `organization: ["update"]`, consistent with the rest of
  org settings.
- **`skillPackageBuilder` → `skillPackage`** (permission-statement key rename only —
  the `skill-package-builder` route/component/module naming is a separate, deferred
  task the user will pick up later; don't touch it here).
- **`skill-package-author` role → `skills-author`** (stored-role enum value rename,
  see DB caveat above).
- **`Roles.member` loses `member: ["view"]`.** Confirmed via investigation that
  every `member: ["view"]`-gated surface (Users list/stat/nav, invite-state lookup,
  user↔person linking) is admin-only; nothing a plain member currently sees depends
  on it (the roster/personnel list they see is gated on `person: ["view"]`
  instead).
- **`skillCheckSession` gains `"approve"`.** `skillCheck` loses `"update"` entirely
  — no role can hold `skillCheck: ["update"]` any more. Editing an existing check is
  a **row-ownership check in the router** (`assessorId === current user`), not a
  permission gate at all.
- **`skills-assessor`**: add `team: ["view"]`; `skillCheck` becomes `["view",
"create"]` (loses `"delete"` — and `"update"` per the point above);
  `skillCheckSession` becomes `["view", "create", "update"]` (loses `"delete"`).
  Deletion of checks/sessions moves to `skills-admin` only.
- **New role `skills-admin`**: `{ skillPackageSubscription: ["view", "subscribe"],
skillCheckSession: ["view", "create", "update", "delete", "approve"], skillCheck:
["view", "delete"] }`. Administers the assessment _workflow_ (approves/cleans up
  sessions, deletes erroneous checks) — does not itself create/assess checks.
  **Only role with `subscribe`.**
- **New role `skills-reporter`**: `{ organization: ["view"], skillCheck: ["view"],
skillCheckSession: ["view"], skillPackageSubscription: ["view"], person: ["view"],
team: ["view"] }`. Pure read-only reporting surface.
- **`skillPackageSubscription: ["view"]` is the one exception** to "only skills-_
  roles hold skill_ permissions" — `member`, `admin`, and `owner` all keep it
  (everyone can see subscribed packages); only `"subscribe"` stays skills-admin-only.
- **Every role gets an explicit, accurate `description`** in
  `OrganizationRole.roles` — in particular `skills-author` ("Creates and publishes
  skill packages (assessment templates) for the org to subscribe to" — not to be
  confused with performing assessments) and `skills-admin` ("Approves and manages
  skill check sessions org-wide; can delete erroneous checks and sessions, but
  doesn't perform assessments itself").
- **Skill Track module nav gated on `skillPackageSubscription: ["view"]`.** Since
  that's now a baseline permission, the module stays visible to everyone; the
  index page's existing per-entry `<Protect>` (Catalogue → `skillPackageSubscription`,
  Checks/Reports → `skillCheck`, Sessions → `skillCheckSession`) already produces
  the right result — a plain member/admin/owner sees the module and Catalogue link
  only. A future "see your own results" feature will bypass regular permissions
  entirely — out of scope here.
- **Deferred, not part of this plan:** renaming the `skill-package-builder`
  route/component/module (`skill-builder`) — a separate task the user will do later.

---

## Current state (verified)

- **`src/lib/permissions.ts`** — `statement` (10 resources incl. `d4hAccessToken`,
  `skillPackageBuilder`); `Roles.owner`/`Roles.admin` = `{...all}` (every action on
  every resource) minus org-delete for admin; `Roles.member` includes
  `member: ["view"]` and `skillPackageSubscription: ["view"]`;
  `Roles["skills-assessor"]` has `skillCheck`/`skillCheckSession` full CRUD, no
  `team`; `Roles["skill-package-author"]` = `{ organization: ["view"],
skillPackageBuilder: [...] }`.
- **`src/lib/schemas/organization-role.ts`** — `organizationRoleSchema` enum incl.
  `owner`, `skill-package-author`; `primaryRoleSchema = ["owner","admin","member"]`,
  `secondaryRoleSchema = ["i3-editor","skills-assessor","skill-package-author"]`;
  `isPrimary` flag per role; `assignmentSchema` requires exactly one primary role;
  `getPrimaryRole`/`getSecondaryRoles` helpers; `isAdminAssignable` field exists but
  is **dead code** (never read anywhere) — today an admin can self-promote to owner
  through any of the three pickers below, which this plan closes as a side effect.
- **Role pickers (all read `primaryRoleSchema`/`secondaryRoleSchema`, so `owner`
  shows unfiltered in every one):**
  - `src/components/admin/invitations/invitation-role-fields.tsx` — shared
    `RoleFields`, `PRIMARY_ROLES` (line 40) mapped to radios; used by invitation
    dialogs and the system-admin add-member dialog.
  - `src/components/admin/users/update-user.tsx` — `AdminModule_UpdateUser_Dialog`
    (org-admin "Edit roles"), owner radio at lines 151–164.
  - `src/components/system-admin/organizations/member-actions-menu.tsx` +
    `add-member-dialog.tsx` — reuse the shared `RoleFields`.
- **`src/trpc/routers/organizations-router.ts`** — `findOwnerMemberships` (line 31),
  `assertNotLastOwner` (line 47, exported, throws `BAD_REQUEST` — reusable as-is),
  `addOrganizationMember` (line 90, `member: ["create"]`), `removeOrganizationMember`
  (line 183, calls `assertNotLastOwner`), `setOrganizationMemberRole` (line 229,
  calls `assertNotLastOwner` when owner is dropped). Roles are written as a plain
  Prisma `role` string update — Better Auth's org-plugin role/ownership APIs are not
  used at all.
- **`src/components/admin/users/user-menu.tsx`** — `AdminModule_User_Menu`,
  `EntityActionMenu` with Edit/Link/Unlink/Delete, `?action=` nuqs pattern — where
  the new Make/Remove-owner items slot in.
- **`skillPackageBuilder`** — 74 permission-key usages (`skillPackageBuilder:`)
  across `skill-package-builder-router.ts`/`.test.ts` (~40 procedures) and every
  `src/components/skill-package-builder/*.tsx` dialog/menu; purely mechanical
  rename to `skillPackage`, **not** touching file/route/component names.
- **`skill-package-author`** — used in `update-user.tsx`, `invitation-role-fields.tsx`,
  `system-admin/organizations/organization-content.tsx`, `src/lib/glossary.ts`,
  `permissions.ts`(`.test.ts`), `organization-role.ts`.
- **`d4hAccessToken` permission** — 3 UI checks (`admin/page.tsx:34`, commented out;
  `d4h-access-tokens-list.tsx:100`; `access-token-content.tsx:88`) plus 5 procedures
  in `d4h-access-tokens-router.ts` (create/delete/view×2/update at lines 41, 164,
  245, 304, 343).
- **`getLinkedUser` fetch/render** (`src/components/admin/personnel/`):
  - `person-content.tsx:38-45` — `useSuspenseQueries` fetches `getPerson` +
    `getLinkedUser` together unconditionally; card rendered at lines ~96-131 with no
    `<Protect>`, just `{linkedUser && (...)}`.
  - `person-menu.tsx` — also receives `linkedUser` as a prop (line 35) and uses it
    (lines 80, 89) to decide whether to show "Invite to AVUT" vs "Unlink"/"Link to
    user" menu items — a second, independent consumer of the same query.
  - `.../personnel/[person_id]/page.tsx:39-41` — prefetches `getLinkedUser`
    unconditionally too.
  - Router: `personnel-router.ts:215` `getLinkedUser: organizationProcedure({
member: ["view"], person: ["view"] })` — **procedure itself is unchanged.**
- **Skill Track nav** — `src/lib/modules.ts:136-143` module registration (not
  `alwaysOn`, no permission field); `src/components/nav/org-sidebar-modules.tsx`
  filters only on `organization.isModuleEnabled(mod.id)` (line 63), no permission
  check; `.../skill-track/page.tsx` already `<Protect>`s each of its four entry
  links individually.

---

## Work breakdown

### 1. `src/lib/permissions.ts`

- Drop `d4hAccessToken` from `statement`.
- Rename `skillPackageBuilder` → `skillPackage` in `statement`.
- `skillCheckSession`: add `"approve"`.
- `skillCheck`: drop `"update"` → `["view", "create", "delete"]`.
- Add `member`'s new `"owner"` action → `member: ["view", "create", "update",
"delete", "owner"]`.
- Rewrite `Roles`:
  - `owner`: `member` full CRUD + `["owner"]`, `invitation` full CRUD,
    `organization` full CRUD (incl. delete), `person` full CRUD, `team` full CRUD,
    `skillPackageSubscription: ["view"]`.
  - `admin`: same as owner minus `organization: ["delete"]` minus `member:
["owner"]`.
  - `member`: drop `member: ["view"]`; keep `skillPackageSubscription: ["view"]`,
    `d4hEquipment: ["view"]`, `organization: ["view"]`, `person: ["view"]`,
    `team: ["view"]`, `...memberAc.statements`.
  - `i3-editor`: unchanged.
  - `skills-assessor`: add `team: ["view"]`; `skillCheck: ["view", "create"]`;
    `skillCheckSession: ["view", "create", "update"]`.
  - `skills-admin` (new): `skillPackageSubscription: ["view", "subscribe"]`,
    `skillCheckSession: ["view", "create", "update", "delete", "approve"]`,
    `skillCheck: ["view", "delete"]`. Remember `organization: ["view"]` too —
    every specialty role needs it or `organizationProcedure` rejects everything.
  - `skills-author` (renamed key, was `skill-package-author`): `organization:
["view"]`, `skillPackage: ["view", "create", "update", "delete", "publish"]`.
  - `skills-reporter` (new): `organization: ["view"]`, `skillCheck: ["view"]`,
    `skillCheckSession: ["view"]`, `skillPackageSubscription: ["view"]`,
    `person: ["view"]`, `team: ["view"]`.
- Update `all`-derived comment/logic if needed — `owner`/`admin` no longer use
  `all` at all now that they're hand-written, so the `all` helper may only be used
  for... check whether anything else in the file still needs `all`; if nothing
  does, remove it rather than leaving dead code.

### 2. `src/lib/schemas/organization-role.ts`

- `organizationRoleSchema`: drop `owner`; rename `skill-package-author` →
  `skills-author`; add `skills-admin`, `skills-reporter`.
- Remove `isPrimary` field from `OrganizationRoleInfo` and every role entry.
- Remove `primaryRoleSchema`, `secondaryRoleSchema`, `getPrimaryRole`,
  `getSecondaryRoles`.
- `assignmentSchema`: drop the "exactly one primary role" refinement; keep the
  no-duplicates refinement; add a non-empty refinement (`roles.length > 0`,
  "Choose at least one role.").
- `serialize`: drop the primary-first sort — plain `roles.join(",")` (order no
  longer matters once there's no primary/secondary concept, but double check
  nothing downstream assumes primary-first ordering of the stored string before
  simplifying — grep `OrganizationRole.serialize` call sites).
- Update `description`s for every role, especially `skills-author` and
  `skills-admin` (wording above).
- A separate `OrganizationRole.ownerSchema` or similar isn't needed — owner is
  handled entirely outside this schema now (see §3).

### 3. Owner transfer

- **Router** (`organizations-router.ts`, alphabetical placement among existing
  procedures):
  - `makeOwner: organizationProcedure({ member: ["owner"] })` — sets the target
    member's role to include `owner` (in addition to whatever else they hold —
    owner is now orthogonal to the flat role set, not exclusive with it).
    Write + `ctx.logEvent(...)` inside one `ctx.prisma.$transaction([...])`.
  - `removeOwner: organizationProcedure({ member: ["owner"] })` — rejects if
    `input.userId === ctx.session.user.id` (self-removal blocked, `BAD_REQUEST`);
    calls `assertNotLastOwner` for the target; strips `owner` from their stored
    role string; same transaction + `logEvent` shape.
  - Both need Zod input schemas in whatever schemas file the router's other
    member-mutation inputs live in.
- **Cache effects** (`src/client/organizations-effects.ts`): add `makeOwner`/
  `removeOwner` entries mirroring `setOrganizationMemberRole`'s invalidations.
- **UI** (`src/components/admin/users/user-menu.tsx`, `AdminModule_User_Menu`):
  add "Make owner"/"Remove owner" menu items (always visible, per the decision
  above — no `<Protect>`/`useHasPermission` gate on the menu item itself),
  `?action=` literals `"make-owner"`/`"remove-owner"` added to the existing
  `parseAsStringLiteral([...])` array. New confirm-style `AlertDialog` components
  (pattern: `member-actions-menu.tsx`'s existing "Remove member" confirm flow) that
  call the new mutations — the permission check (and last-owner/self-removal
  errors) surfaces as the mutation's own error inside the dialog, not as a
  disabled trigger.

### 4. `d4hAccessToken` → `organization: ["update"]`

- `d4h-access-tokens-router.ts`: replace all 5 `d4hAccessToken: [...]` procedure
  gates with `organization: ["update"]`.
- `admin/page.tsx:34` (currently commented out — leave as-is or update the dead
  comment while touching the file), `d4h-access-tokens-list.tsx:100`,
  `access-token-content.tsx:88`: replace `<Protect permissions={{ d4hAccessToken:
[...] }}>` with `<Protect permissions={{ organization: ["update"] }}>`.
- Delete `d4hAccessToken` from `statement` (done in §1) — confirm no other file
  references it (`grep -rn "d4hAccessToken:" src` should come back empty outside
  test fixtures once done).

### 5. `skillPackageBuilder` → `skillPackage` rename

Mechanical, permission-key only:

```
grep -rl "skillPackageBuilder:" src --include="*.ts" --include="*.tsx" \
  | xargs sed -i '' 's/skillPackageBuilder:/skillPackage:/g'
```

Applies across `skill-package-builder-router.ts`/`.test.ts` and every
`src/components/skill-package-builder/*.tsx`. **Do not** touch the route segment
(`orgs/[slug]/skill-package-builder/...`), file names, component names
(`AdminModule_SkillPackageBuilder_*` etc.), or the `skill-package-builder` module
id in `src/lib/modules.ts` — those are the deferred rename. Verify with
`npm run check` afterwards since this is a pure identifier swap the type checker
will catch if anything's missed (e.g. a `skillPackageBuilder` used as a variable
name rather than a permission key, which the blind sed could mis-hit — review the
diff).

### 6. `skill-package-author` → `skills-author` rename

- `organization-role.ts` (done in §2).
- `permissions.ts` `Roles` key (done in §1).
- `update-user.tsx`, `invitation-role-fields.tsx`,
  `system-admin/organizations/organization-content.tsx`, `src/lib/glossary.ts`,
  `permissions.test.ts` — update the string literal everywhere it's referenced.
- **DB verification step** — see the Branch/DB note at the top; do this check
  before merging, not after.

### 7. Role picker UI — flatten + drop owner

All three pickers (`invitation-role-fields.tsx`'s shared `RoleFields`,
`update-user.tsx`, and whatever `member-actions-menu.tsx`/`add-member-dialog.tsx`
reuse) currently render a radio group (primary) + checkbox group (secondary).
Replace with a single checkbox/multi-select list over
`OrganizationRole.values.filter(r => r !== "owner")` — no radio group, no
`PRIMARY_ROLES` constant, no "choose exactly one" validation message (replace with
"choose at least one" matching the new `assignmentSchema` refinement). Since
`admin`/`member` are no longer mutually exclusive, both can be checked
simultaneously — no special-casing needed once the picker is just a flat list.

### 8. `getLinkedUser` — defer the fetch, decoupled from the menu

No procedure change — `personnel-router.ts:215` stays as-is.

- **`person-content.tsx`**: remove `getLinkedUser` from the `useSuspenseQueries`
  call (keep only `getPerson`). Extract the "Linked User Account" card into its own
  component (e.g. `AdminModule_Person_LinkedUser_Card`, own file, own
  `useSuspenseQuery` for `getLinkedUser`), rendered as:
  ```tsx
  <Protect permissions={{ member: ["view"] }}>
    <Suspense fallback={<CardLoadingFallback />}>
      <AdminModule_Person_LinkedUser_Card personId={person.id} />
    </Suspense>
  </Protect>
  ```
  (mirrors the existing `AdminModule_Person_TeamMemberships_Card` pattern already
  in this file).
- **`page.tsx`** (`.../personnel/[person_id]/page.tsx:39-41`): drop the
  `getLinkedUser` prefetch entirely — no server-side fetch for it at all now; it's
  a plain client fetch once the card mounts.
- **`person-menu.tsx`**: stop receiving `linkedUser` as a prop from the parent.
  Instead, do its own permission-gated fetch: `useHasPermission({ member: ["view"]
})`, and only run a (non-suspense) `useQuery(trpc.personnel.getLinkedUser
.queryOptions(..., { enabled: canViewMember }))` when true. When `false` (or
  still loading), treat `linkedUser` as unknown and default the menu to the
  "not linked" branch (show Invite/Link, not Unlink) — the underlying
  invite/link/unlink mutations enforce their own permissions regardless of what
  the menu displays, so a wrong default here is a UX nit, not a security gap.
  Update `AdminModule_PersonMenuProps` accordingly (drop the required `linkedUser`
  prop from `person-content.tsx`'s call site too).

### 9. Skill Track nav gating

`src/components/nav/org-sidebar-modules.tsx` — the `orgModules` filter currently
only checks `organization.isModuleEnabled(mod.id)` (line 63). Add a permission
check for the `skill-track` module id specifically: something like
`useHasPermission({ skillPackageSubscription: ["view"] })` combined into the
filter (e.g. a small per-module `requiredPermission` lookup keyed by module id, or
an inline `mod.id !== "skill-track" || canViewSkillPackages` condition — keep it
minimal, this is currently a one-module special case, don't over-generalize the
registry for it). Given `skillPackageSubscription: ["view"]` is now baseline for
`member`/`admin`/`owner` too, this mostly just documents/enforces what's already
true rather than actually hiding the module for anyone in practice today — but it
future-proofs a role that somehow lacks it.

### 10. Tests

- `src/lib/permissions.test.ts` — rewrite to match the new `Roles` shapes; add
  cases for `skills-admin`/`skills-reporter`; update/remove
  `skill-package-author` references.
- `src/trpc/routers/skill-package-builder-router.test.ts` — mechanical
  `skillPackageBuilder` → `skillPackage` in permission fixtures (same sed as §5,
  scoped to test files, or included in the same pass).
- `organizations-router.test.ts` (if it exists — check) — add coverage for
  `makeOwner`/`removeOwner`: happy path, last-owner guard, self-removal block,
  non-owner caller rejected.
- `skill-checks-router.test.ts` / `skills-router.test.ts` — update for
  `skillCheck` losing `"update"` (ownership-check tests instead), `skillCheckSession`
  gaining `"approve"`.
- Any test exercising `Roles.member`'s `member: ["view"]` or
  `OrganizationRole.getPrimaryRole`/`getSecondaryRoles`/`primaryRoleSchema` needs
  updating or removing.

---

## Open questions / deferred

- **Skill-package-builder UI rename** (`skill-package-builder` → `skill-builder`
  route/component/module naming) — explicitly deferred, the user will pick it up
  separately.
- **"See your own results" bypass** for plain members on Reports/Checks — future
  work, will intentionally bypass the regular permission system; not designed here.
- Confirm no other file assumes `OrganizationRole.serialize`'s primary-first
  ordering before simplifying it to a plain join (§2) — a quick grep of call sites
  during implementation, not resolved here.
