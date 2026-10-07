# Implementation plan: Entity action consistency

**Date:** 2026-09-25
**Tracks:** [#259](https://github.com/redcloud-nz/avut/issues/259) and its sub-issues #178,
#181, #225, #260, #261, #262, #263 and #264.
**Branch:** `feat/entity-action-consistency`, worktree `.claude/worktrees/entity-actions`,
based on `origin/integration` at `6d96bf02` (v0.10).
**DB:** `avut_entity_actions`, created with `db:branch`. Only Phase 4 (#225) adds a migration,
but the branch has its own copy from the start so that migration never reaches shared `avut`.

The work is split into four phases, each one a coarse PR in a stack. Phases 1–3 are code only.
Phase 4 carries the one schema change and has the widest reach, so it goes last and can be
reviewed on its own.

| Phase | PR scope                         | Issues                        | Migration |
| ----- | -------------------------------- | ----------------------------- | --------- |
| 1     | Menu foundations                 | #263, #264 (shell only), #181 | no        |
| 2     | Person ↔ user linking, user menu | #260, #178, #261 (Unlink)     | no        |
| 3     | Team-membership actions          | #261 (Add to team), #262      | no        |
| 4     | Team archive / restore           | #225                          | **yes**   |

#258 (a recoverable deletion mechanism across all entities) is out of scope. Phase 4 adds
`RecordStatus` to `Team` in the way #258 expects, so it moves that issue forward without
depending on it.

---

## Current state (checked on `6d96bf02`)

The facts below shape the plan and correct a few assumptions in the issue text.

- **Six menus already use `MenuAction` + `useMenuActionHotkeys`.** They are person, team,
  session, skill-package, skill-group and skill, plus two user-settings menus. Each one
  hand-rolls the same `DropdownMenu` → ghost icon `Button` → `DropdownMenuContent align="end"` →
  `DropdownMenuLabel "Actions"` shell. #264 counts only the person and team menus, but the
  duplication is wider than that.
- **Row-level action menus already exist on list pages.** `invitations-list.tsx` and
  `system-admin/users/user-actions-menu.tsx` both have them. They use bare `DropdownMenuItem`s
  with no hotkeys. So #264's premise that no list has row actions is not quite right, and those
  two are the precedent to design against.
- **Update dialogs are self-triggered.** `AdminModule_Update{Person,Team,User}_Dialog` each
  render their own pencil `<DialogTrigger>` and own `?action=update`. The person and team menus
  offer "Edit" by setting the same param, so the pencil on the card and the menu item both open
  one dialog. The person and team pages therefore have Edit in **both** places.
- **The add-membership dialogs are self-triggered, with different params and different
  filtering.**
  - `add-person-to-team.tsx` uses `?action=add-to-team` and lists every team.
  - `add-team-member.tsx` uses `?action=add-member`, renders its own "New Member" button, and
    lists `listPersonnel`. That query returns **Archived** people as well as active ones,
    which is an existing gap.
- **Person archive/restore fire straight from the menu.** They use `toast.promise(mutateAsync)`,
  so `Alt+A` archives a person on a single keypress. The house rule for this shape
  ([`mutation-dialog.md`](../patterns/mutation-dialog.md) § "State-transition confirm") is a
  plain `Dialog` (not an `AlertDialog`), one component per verb. `skill-package-builder/archive-package.tsx`
  is the in-repo precedent.
- **Linking is only reachable from the user page.**
  - `users.linkPerson` takes `{ userId, personId }`. `users.unlinkPerson` takes `{ userId }`
    and returns the `personId`. Both need `member: ["update"], person: ["update"]`.
  - `personnel.listUnlinkedPersonnel` feeds the user-side picker. There is no equivalent query
    that lists members without a linked person.
  - The person page already fetches `personnel.getLinkedUser`, which returns `userId`, so
    Unlink from the person side needs no new server code.
- **Hotkey verbs.** `ActionHotkey` in `src/lib/hotkeys.ts` has create, update, delete, archive,
  restore, publish, unpublish, move, export, import and invite. There is nothing for link,
  unlink or adding a membership. `MenuAction` items are keyed by `verb`, so each verb can appear
  only once per menu.
- **`listTeams` returns every team with no filter.** It is read by the teams list, the admin
  dashboard stats, `add-person-to-team`, `import-team-from-d4h`, session personnel, the skill,
  team and matrix report pages and their scope dialogs, and `client/collections/teams.ts`.
  `listPersonnel` sets the precedent: it returns everything that isn't Deleted, and consumers
  filter on the client.
- **D4H team sync is per team and manual** (`planD4HTeamSync` / `applyD4HTeamSync`). There is
  no background or bulk sync, so "exclude archived teams from sync" means guarding those two
  procedures and hiding the menu items.
- **Tailwind is v4.1**, so `max-md:` and `pointer-coarse:` variants are available.
  `useIsMobile()` (`src/hooks/use-mobile.ts`) uses the same 768px (`md`) breakpoint.

---

## Phase 1: Menu foundations (#263, #264, #181)

### 1a. Hide hotkey badges on small screens (#263)

In `MenuAction` (`src/components/ui/menu-action.tsx`), give the `DropdownMenuShortcut` the class
`max-md:hidden`. Use CSS rather than `useIsMobile()`: the hook reads `window` in an effect, so
the first render would show the badge and then remove it. Registration is unaffected, because
`useMenuActionHotkeys` never looks at the badge. That keeps the issue's requirement that a small
screen with a keyboard still gets working shortcuts.

This single change covers every menu that uses `MenuAction`, including the ones added in later
phases.

### 1b. Extract the menu shell (#264, first step only)

Add `EntityActionMenu` (working name) to `src/components/ui/menu-action.tsx`, next to
`MenuAction`:

```tsx
<EntityActionMenu
  actions={actions} // MenuActionProps[]; renders the "Actions" group
  category="Personnel" // passed to useMenuActionHotkeys
  width="w-50"
  before={<HistoryLinkGroup />} // optional groups above Actions (links)
  after={<D4HGroup />} // optional groups below (team menu's D4H section)
/>
```

It owns the trigger button, the content, the Actions label and the hotkey registration.
Everything entity-specific stays in the caller: which actions exist, their permission checks
(`useHasPermission`), the `?action=` param, and the dialogs. Migrate the person and team menus
in this PR. The new user menu in Phase 2 is built on the shell from the start. The
skill-package and session menus move over only when they are next touched; they are not part of
this work.

The data-driven, list-row part of #264 stays a write-up. See [Appendix: #264 findings](#appendix-264-findings)
for the text to post on the issue.

### 1c. Person archive/restore behind confirm dialogs (#181)

- Add `personnel/archive-person.tsx` and `personnel/restore-person.tsx`. Each is a plain
  `Dialog` driven by `{...props}` (Recipe C), with no form. It has a description naming the
  person in `<ObjectName>`, a `MutationButton`, `onCloseAutoFocus={(e) => e.preventDefault()}`
  (the trigger is a menu item), and a reset effect keyed on `open`. Copy the shape from
  `archive-package.tsx`.
- In `person-menu.tsx`, add `"archive"` and `"restore"` to the literal list. The menu items and
  the `Alt+A` / `Alt+R` hotkeys now call `setAction(…, { history: "push" })`, and
  `handleArchive`, `handleRestore` and the `toast.promise` calls are deleted. Keep the
  `personnelEffects.archivePerson` / `restorePerson` effects exactly as they are.
- The archive description should say what archiving does: the person stays on their teams and
  keeps their history, and they drop out of the default Active personnel filter.

**Tests.** Neither dialog has logic of its own, and the router already covers the mutations.
Verify in the browser that `Alt+A` now opens a dialog and does not archive on the keypress.

---

## Phase 2: Person ↔ user linking and the user menu (#260, #178, #261 Unlink)

### 2a. Hotkey verbs

Add these to `ActionHotkey`:

| Verb     | Key     | Notes                                                                                  |
| -------- | ------- | -------------------------------------------------------------------------------------- |
| `link`   | `Alt+L` |                                                                                        |
| `unlink` | `Alt+L` | Shares the key with `link`. The two are mutually exclusive on any page, like a toggle. |

Update the registry comment to say that some verbs deliberately share a key when they can never
be registered at the same time. (Decided 2026-09-25: share the key rather than give `unlink` its
own. `Alt+U` is taken by `unpublish`, and nothing else has a mnemonic.)

### 2b. User menu (#260)

Add `users/user-menu.tsx`, `AdminModule_User_Menu({ member, linkedPerson })`, on the Phase 1
shell with category `"Users"`. Its actions are:

| Verb     | Label       | Shown when         | Permission (must match the mutation)       |
| -------- | ----------- | ------------------ | ------------------------------------------ |
| `update` | Edit        | always             | `member: ["update"]`                       |
| `link`   | Link person | no linked person   | `member: ["update"]`, `person: ["update"]` |
| `unlink` | Unlink      | a person is linked | `member: ["update"]`, `person: ["update"]` |
| `delete` | Delete      | always             | `member: ["delete"]`, and not yourself     |

- The menu owns `?action=` with the values `update | delete | link-person | unlink-person`, and
  hosts the delete, link and unlink dialogs that `user-content.tsx` hosts today. They are
  already host-driven, so they move over unchanged.
- Edit sets `?action=update`, which opens the existing self-triggered
  `AdminModule_UpdateUser_Dialog`. **Keep the pencil on the User Details card.** The person and
  team pages have Edit on both the card and the menu, and the point of this work is to match
  them. #260 says to "move" Edit, but keeping both was decided on 2026-09-25.
- Remove the Link/Unlink `CardAction` from the Linked Person card. Render that card only when
  `linkedPerson` is set, which also removes the "No linked person." empty state.
- The two `useQueryState("action", …)` calls, in the menu and in `UpdateUser_Dialog`, parse
  different literal sets over the same param. That is the same arrangement the person and team
  pages already use, and it's safe because each verb opens exactly one dialog.

### 2c. Link and unlink from the person page (#178, #261 Unlink)

**Server.** Add `users.listUnlinkedMembers` with `organizationProcedure({ member: ["view"], person: ["view"] })`.
It returns the org's `OrganizationUser` rows where `personId` is null, as
`{ userId, name, email }`, sorted by name. It is the mirror of
`personnel.listUnlinkedPersonnel`, and it reads the org-user table with Prisma the way
`listPersonLinks` does. Filtering Better Auth's `listMembers` on the client would also work,
but that query needs `member` access through the auth client and puts the filtering in the
dialog, where it's harder to test. Add router tests beside the existing `users-router.test.ts`
link tests: it excludes linked users, it's org-scoped, and it's forbidden without
`member: ["view"]`.

**Dialogs.**

- Add `personnel/link-user.tsx`, `AdminModule_LinkUser_Dialog({ person, ...props })`, as the
  mirror of `users/link-person.tsx`. It has a `SearchableSelect` over `listUnlinkedMembers` and
  calls the existing `users.linkPerson` with `usersEffects.linkPerson`. That effect already
  invalidates `personnel.getLinkedUser`, `getInviteState` and `listUnlinkedPersonnel`, so no
  effects change is needed. It must also invalidate `listUnlinkedMembers`, so add that line.
- For Unlink, reuse `AdminModule_UnlinkPerson_Dialog`, passing `userId` from
  `linkedUser.userId`. Its copy ("Unlink person X from user Y") reads correctly from either
  side. Move it to a neutral location, `src/components/admin/person-user-link/`, alongside
  `link-person.tsx` and `link-user.tsx`, so neither page imports from the other's folder.
  Check that `usersEffects.unlinkPerson` invalidates `personnel.getLinkedUser`, since the person
  page now depends on it.

**Person menu.** Add `"link-user"` and `"unlink-user"` to the literals.

| Verb     | Label            | Shown when                  | Permission                                 |
| -------- | ---------------- | --------------------------- | ------------------------------------------ |
| `invite` | Invite to AVUT   | Active and not linked (now) | `invitation: ["create"]` (now)             |
| `link`   | Link to user     | not linked                  | `member: ["update"]`, `person: ["update"]` |
| `unlink` | Unlink from user | linked                      | `member: ["update"]`, `person: ["update"]` |

Invite and Link both appear for an unlinked person, because they answer different situations:
the person has no account yet, or they already have one. Also turn the User ID on the Linked
User Account card into a link to `/orgs/[slug]/admin/users/[user_id]`, matching how the user
page links to the person. Otherwise the two pages still aren't navigable in both directions.

---

## Phase 3: Team-membership actions (#261 Add to team, #262)

### 3a. One add-membership dialog

Replace `add-person-to-team.tsx` and `add-team-member.tsx` with a single host-driven dialog,
`teams/add-team-membership.tsx`:

```tsx
AdminModule_AddTeamMembership_Dialog(
    props: DialogProps & ({ person: PersonRef } | { team: TeamData })
)
```

- Whichever side is fixed decides the picker. Given a person, it picks a team; given a team, it
  picks a person. Both call `teams.createTeamMembership` with `teamsEffects.createTeamMembership`,
  as today.
- The pickers filter consistently. The team picker excludes teams the person already belongs to
  and, after Phase 4, Archived teams. The person picker excludes existing members and anyone
  who isn't `Active`, which fixes the current Archived-people gap.
- Use one param value, `?action=add-membership`, on both pages. Nothing links to the old
  `add-to-team` / `add-member` values, so renaming them is safe.
- The dialog is host-driven (Recipe C) and takes `open` / `onOpenChange`. Its only trigger-owned
  state today is the "New Member" button, which moves to the host (see 3c).

If folding them turns the body into a tangle of conditionals, keep two thin wrappers around a
shared body component instead. The point is one param value and one filtering rule, not one
file.

### 3b. Hotkey verb

Reuse the existing `create` verb (`Alt+N`); no new verb is added. On these pages the new record
is a team membership. The label differs by page: "Add to team" on a person, "Add person" on a
team, both with `ObjectIcons.Create`. Neither detail menu has any other `create` action, so the
`verb` key stays unique in each menu. (Decided 2026-09-25.)

### 3c. Wiring

- **Person menu (#261).** Add `create` / "Add to team", shown when the person is
  `Active`, with permission `team: ["update"]` (which is what `createTeamMembership` needs). The
  Teams card keeps its `+` `CardAction`, which now sets `add-membership`. Either the menu or the
  card hosts the dialog, not both. Put it in the menu, since the menu is always mounted and the
  Teams card sits inside a `Suspense`.
- **Team menu (#262).** Add `create` / "Add person" with `team: ["update"]`. Host the
  dialog in `team-menu.tsx`.
- **Team overview card (#262).** Add a `+` `CardAction` to the "Related" card
  (`team-links.tsx`), next to the Personnel count and gated with `<Protect permissions={{ team: ["update"] }}>`.
  It sets the param.
- **Team members page.** Keep the "New Member" header button. It becomes a plain `Button` that
  sets the param, and the page hosts the dialog itself because `team-menu` isn't mounted there.

**Tests.** If the merged dialog's option filtering is extracted as a pure function, test it
there. That is the logic that has drifted before. Otherwise verify in the browser from all four
triggers.

---

## Phase 4: Team archive / restore (#225)

This follows #225's proposal, with the open questions answered below. Ask before running
`migrate dev`, even against the branch DB.

### 4a. Schema and migration

- In `Team`, add `status RecordStatus @default(Active)`. Existing rows backfill to Active through
  the default, so no data migration is needed.
- Add `status` to `TeamData` (`src/lib/schemas/team.ts`) and to `fromRecord`.
- In `.env.local`, confirm `POSTGRES_DATABASE="avut_entity_actions"`, then stop the dev server
  for this worktree if one is running and, **with permission**, run
  `npm run prisma migrate dev --name team_status`.

### 4b. Router

- Add `archiveTeam` and `restoreTeam` to `teams-router.ts`, copying
  `archivePerson`/`restorePerson`: `team: ["update"]`, idempotent (return the record unchanged
  if it is already in the target state), `NOT_FOUND` for a missing or other-org team, and the
  write paired with `ctx.logEvent({ action: "Archive" | "Restore", objectType: "Team", objectId })`
  in `$transaction`. Keep the procedures in alphabetical order as `src/trpc/CLAUDE.md` requires.
- Leave `listTeams` unfiltered. It keeps returning every team, and consumers filter on
  `status` the way they do for personnel. Filtering on the client means a report scope or URL
  that references an archived team still resolves its name. A server-side filter would make that
  team silently disappear.
- Guards:
  - `createTeamMembership` returns `BAD_REQUEST` if the team isn't Active.
  - `planD4HTeamSync` and `applyD4HTeamSync` return `BAD_REQUEST` for an archived team.
  - `deleteTeam` is unchanged.
- Add `archiveTeam` / `restoreTeam` to `src/client/teams-effects.ts`. Each writes `getTeam` and
  invalidates `listTeams`, the same as `personnelEffects.archivePerson`.
- Router tests: archive and restore round-trip, idempotency, the log entries, cross-org
  `NOT_FOUND`, the permission check, and each guard above.

### 4c. UI

- **Team menu.** Add Archive or Restore depending on status, through `teams/archive-team.tsx` /
  `teams/restore-team.tsx` confirm dialogs built the same way as Phase 1c. Do not repeat the
  fire-directly pattern #181 removes. For an archived team, hide Add person, and hide Sync with
  D4H in the D4H group.
- **Team page.** Show Status in the Team Details `DL`, the way the person page does.
- **Teams list.** Add a Status column with a default `["Active"]` filter, copying
  `personnel-list.tsx`.
- **Consumers.** Filter `team.status === "Active"` in:
  - the add-membership picker (Phase 3)
  - the team and skill scope dialogs, and the report pages' default team
  - session personnel's team filter
  - the admin dashboard team count, which counts Active teams only (decided 2026-09-25)

  Check `import-team-from-d4h.tsx` and `client/collections/teams.ts` as well: the first uses
  `listTeams` for duplicate detection, which must still see archived teams.

### 4d. Answers to #225's open questions (proposed)

1. **Can an archived team be deleted?** Yes. Delete doesn't depend on archive state, which is
   how the person menu behaves (Delete shows for anyone not Deleted).
2. **Can a D4H-linked team be archived? Does re-import restore it?** It can be archived. Its
   link stays, and sync is refused while it is archived. Importing the same D4H team again hits
   the existing `team_D4H` duplicate check. Change that error to name the archived team and say
   "restore it instead" rather than restoring it silently.
3. **Do reports include archived teams' history?** The scope pickers hide archived teams, so a
   new report can't pick one. A saved or linked scope that already names one still renders,
   because `listTeams` stays unfiltered. Nothing else changes.

---

## Verification

- `npm run check` after each phase, and `npm run check -- --all` before the stack goes up.
- In the browser, following [`avut-test-in-browser`](../../.claude/skills/avut-test-in-browser/SKILL.md),
  from **this worktree's** dev server on its own port. Ask first; `npm run dev -- -p 3102`
  reaches `avut_entity_actions`. Use the `demo` org, whose people are synthetic. Linking sends
  no email, but Invite does, and `sendEmail`'s redirect covers that.
  - Phase 1: at a width under 768px there are no badges, and `Alt+E` still works with a
    keyboard. `Alt+A` / `Alt+R` open dialogs.
  - Phase 2: link and unlink from both pages, and check that each page reflects the other's
    change without a reload (the effects). Check the menus' disabled states for a `member`
    role, and that you can't delete yourself.
  - Phase 3: add a membership from all four triggers, and check that archived people are
    absent from the picker.
  - Phase 4: archive → the team drops out of the default list, the pickers and the scope
    dialogs; its page still loads; sync is refused; restore brings it back.
- Run `/avut-conventions-review` over each phase's diff before committing it.

## Decisions (2026-09-25)

1. `link` and `unlink` share `Alt+L`.
2. The user page has Edit in both places, the card pencil and the menu, like person and team.
3. Adding a membership reuses the `create` verb (`Alt+N`).
4. The admin dashboard team count shows Active teams only.

---

## Appendix: #264 findings

To post on #264 once Phase 1 lands.

**What's shared today.** Eight menus render `MenuAction` items inside an identical hand-written
shell. Phase 1 extracts that shell (`EntityActionMenu`: trigger, content, Actions group, hotkey
registration), and person, team and the new user menu use it. The rest move over when touched.

**Why not a data-driven menu shared between detail pages and list rows.**

- **Hotkeys don't scale to rows.** `useMenuActionHotkeys` registers global `Alt+<key>`
  shortcuts. On a list with N rows that means N registrations of `Alt+E`. A row menu would have
  to render `MenuAction` without registering, and the shell would need a `hotkeys={false}` mode.
  That's easy to add, but it shows that the two uses aren't really the same component.
- **Dialogs are one per page.** Every entity dialog is driven by `?action=<verb>` with the page
  as its single host. A row action is the "nested entity" shape in `mutation-dialog.md`: it
  needs a second param (`&personId=…`), and a host that resolves the row from the list query.
  The detail menus' dialog wiring can't be reused as it is.
- **Verbs are entity-agnostic by rule.** Two menus parsing the same verb set on one page would
  both open on `?action=archive`, so a list row menu can't sit beside a detail menu that shares
  its verbs.
- **The entity logic is the bulk of each menu**: which actions apply in which state, their
  permissions, and self-delete guards. A data-driven descriptor (`defineEntityActions(person) → MenuActionProps[]`)
  would just move that logic into a different file.

**Recommendation.** Stop at the shell for now. If row actions are wanted, the likely shape is a
per-entity `use<Entity>Actions(entity, { setAction })` hook that returns `MenuActionProps[]`.
Both the detail menu and a row menu would call it: the detail menu with hotkeys, the row menu
without, and each wiring its own dialog params. The two existing row menus
(`invitations-list.tsx` and `system-admin/users/user-actions-menu.tsx`) are the first things to
try it on.
