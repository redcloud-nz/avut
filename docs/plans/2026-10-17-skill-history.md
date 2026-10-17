# History for skill groups and skills, and package history that covers them

**Date:** 2026-10-17
**Issue:** [#342](https://github.com/redcloud-nz/avut/issues/342) (follow-up to #341 / #48, plan `docs/plans/2026-09-30-object-history.md`)
**Branch:** `feat/skill-history`, worktree `.claude/worktrees/skill-history` (dev server on its `.dev-port`, 3108)
**DB:** no migration; shared `avut`. Ref roles are stored as text, so activating `from`/`to` needs no schema change.
**D4H:** not involved.
**Written against:** integration @ 12d0c8d1

## Decisions

- **Write refs, don't join at read time** (the issue's proposal). Every `Skill` and `SkillGroup` entry carries a `{ objectType: "SkillPackage", role: "context" }` ref, and every `Skill` entry also carries a `{ objectType: "SkillGroup", role: "context" }` ref.
  - The history service already fans out on any non-primary ref, so these entries then show on the package's and the group's History pages with no read-side query change.
  - This covers `Purge` from the Rubbish bin (`trash.ts`). A purged skill's own page 404s, so its package and group pages are the only place a purge can show.
  - Entries written before this branch don't gain refs. The gap closes only for new entries, and nothing backfills them.
- **The refs come from one helper.** `SkillPackages.skillLogRefs(skill)` and `SkillPackages.groupLogRefs(group)` in `src/server/services/skill-packages.ts` return the `LogEntryRef[]` for a record. Every call site uses them, so a future one can't forget the group ref.
- **Gate first.** `HistoryObjects` gains `SkillGroup` and `Skill` with `{ skillPackage: ["view"] }`, the permission `getGroup`/`getSkill` already require. This lands before any entry carries the new refs, as the `RelatedEntryPermissions` doc asks. Being in `HistoryObjects`, they need no `RelatedEntryPermissions` entry.
- **Moves use `from`/`to`** (decided with the user 2026-10-17).
  - `moveSkill` refs the old group as `from` and the new group as `to`, so the entry shows on both groups' History pages.
  - On a cross-package move, which the procedure allows, the packages get `from`/`to` too. Otherwise the package is `context`.
  - An import update that changes a skill's group refs its groups the same way.
  - This is the first live use of the dormant roles. Update the "DORMANT" note in `log-entry.ts`.
- **`moveSkill` logs `Move`, not `Update`.** `Move` is a dormant `LogAction` whose note says exactly this ("moveSkill logs Update"). Old `Update` move entries keep rendering as now.
  - A move to the skill's current group is a no-op: no write and no entry.
  - `FieldLabels.Skill` gets `{ skillGroupId: "Group", skillPackageId: "Package" }`, so the move diff reads "Group: Medical → Rescue".
- **A related entry names its own object.** On a package page, a `Skill` entry would otherwise read "Updated skill" with no way to tell which skill. The entry's own object isn't one of its `refs`, and non-Person/Team refs show their type only.
  - `ObjectHistoryEntry` gains `objectName: string | null`, the current name of the entry's own object. It's resolved for `Skill`, `SkillGroup` and `SkillPackage` entries, and `null` for every other type.
  - The generic `ObjectHistoryRef` member gains `name: string | null`, resolved for the same three types.
  - Both resolve only when the caller may view the type (`relatedTypes`, as `Person`/`Team` names do), and only for records in this organization's own packages.
  - A purged or unviewable record comes back `null`. The UI then shows the bare phrase ("Updated skill"), and **never** falls back to a ref's name: a purged skill's group name would read as the skill's name.
  - The ref-name fallback stays only for entry types `objectName` never resolves (today's `TeamMembership` phrases).
  - Names stay plain text. Linking them to builder pages is out of scope.
- **Move ids resolve to names.** `IdFieldTarget` grows to `"Person" | "Skill" | "SkillGroup" | "SkillPackage"`, and `IdFields` adds `Skill: { skillGroupId: "SkillGroup", skillPackageId: "SkillPackage" }`. `ObjectHistoryPage.names` gains `SkillGroup` and `SkillPackage` maps. Reorder changes aren't touched: `ChangeLine` renders `arr_ord` as a bare "reordered", so names would never be shown.
- **Wording.**
  - `relatedActionPhrases` gains `Skill`→`SkillPackage`, `SkillGroup`→`SkillPackage` and `Skill`→`SkillGroup`. The phrases are "Added skill", "Updated skill", "Archived skill", "Restored skill", "Recovered skill", "Deleted skill", "Permanently deleted skill" and "Moved skill", with the same set for "group".
  - A phrased related entry puts `objectName` after the phrase: "Updated skill CPR — Demo Owner".
  - A `from`/`to` ref in the details says so: "from Skill group Medical".
- **Subscribers get nothing** (decided with the user 2026-10-17). `skill-track/catalogue/[package_id]` is unchanged. History is org-scoped, and showing an author's history to a subscriber is a cross-org read that needs its own design.

## Tasks

### Review group 1: write side

- [x] **1. Skill and SkillGroup History types** — feat(history): add Skill and SkillGroup history object types
  - **Files:** `src/lib/schemas/object-history.ts`, `src/trpc/routers/history-router.test.ts`
  - **Do:** add `"Skill"` and `"SkillGroup"` to `historyObjectTypeValues` and `HistoryObjects` (`{ skillPackage: ["view"] }`, with comments naming `skillPackageBuilder.getSkill` / `getGroup`).
  - **Done when:**
    - `history.listObjectHistory` accepts `Skill` and `SkillGroup`, and rejects a caller without `skillPackage:view`.
    - The existing "gives an admin every related type but the registry types it can't view" expectation also excludes `Skill`/`SkillGroup`.
    - `npm run check` passes.

- [x] **2. Package and group refs on service-written entries** — feat(history): ref package and group on service-written skill entries
  - **Files:** `src/server/services/skill-packages.ts`, `src/server/services/skill-packages.test.ts`, `src/server/services/trash.ts`, `src/server/services/trash.test.ts`
  - **Do:**
    - **Helpers:** add and export `skillLogRefs(skill: Pick<Skill, "skillPackageId" | "skillGroupId">): LogEntryRef[]` (package `context` + group `context`) and `groupLogRefs(group: Pick<SkillGroup, "skillPackageId">): LogEntryRef[]` (package `context`), each with a JSDoc pointing at #342. Import `LogEntryRef` as a type from `@/server/log-entry`.
    - **Lifecycle:** pass `refs` on `archiveSkill`, `setSkillActive` (restore and recover), `deleteSkill`, `archiveGroup`, `setGroupActive` and `deleteGroup`. Build them from the `existing` record the caller already holds, and pass it into `setSkillActive`/`setGroupActive` rather than re-reading.
    - **Import:**
      - Add `refs?: LogEntryRef[]` to `SkillPackageWriteItem.log`.
      - A group item gets `groupLogRefs({ skillPackageId: incoming.id })`.
      - A skill create/update gets `skillLogRefs` with `incoming.id` and the group it's upserted into. When an update changes the skill's group (`groupChanged`), give the old group as `from` and the new one as `to` in place of the group `context` ref.
      - An archived skill node uses its current group, `existingSkills.get(node.id)!.skillGroupId`, with no extra query.
      - `importPackage` and `importPackageAsAdmin` spread `...item.log`, so neither router changes.
    - **Purge:**
      - In `trash.ts`, give `purgeLog` an optional `refs` param.
      - The `skillGroup` and `skill` handlers select `skillPackageId` (and `skillGroupId` for skills) in their lookup, and pass `groupLogRefs`/`skillLogRefs`.
    - Keep each write paired with its `logEvent` in the same `$transaction` (docs/patterns/transactional-writes.md).
  - **Done when:**
    - **Lifecycle:** tests assert the stored refs (role and target) for archive, restore, recover and delete of a skill, and the same four for a group.
    - **Import:** an import that creates a group and a skill, updates one, moves one between groups (`from`/`to`), and archives one.
    - **Purge:** purging a skill and a group.
    - `npm run check` passes.

- [ ] **3. Package and group refs on router-written entries; moves log `Move` with `from`/`to`**
  - **Files:** `src/trpc/routers/skill-package-builder-router.ts`, `src/trpc/routers/skill-package-builder-router.test.ts`, `src/lib/schemas/log-entry.ts` (comments only), `src/lib/diff-format.ts` (`FieldLabels` only)
  - **Do:**
    - `createGroup`, `updateGroup` and `reorderGroupSkills` (a `SkillGroup` `Update`): `refs: SkillPackages.groupLogRefs(…)`. `reorderGroups` logs the package itself, so it is unchanged.
    - `createSkill`, `updateSkill`: `refs: SkillPackages.skillLogRefs(…)`.
    - `moveSkill`:
      - Return the skill unchanged, writing nothing, when `destinationGroupId === skill.skillGroupId`.
      - Otherwise log `action: "Move"`, with the old group `from` and the new group `to`.
      - The package is `context` when unchanged, else the old package `from` and the new package `to`.
      - Keep `changes` and `description`.
      - Update the JSDoc.
    - `FieldLabels.Skill = { skillGroupId: "Group", skillPackageId: "Package" }`.
    - In `log-entry.ts`, drop "DORMANT" from `Move` and from the `from`/`to` note. Say `moveSkill` and skill-package import are the users.
  - **Done when:**
    - Router tests assert the refs on each of those entries.
    - **Same-package move:** action `Move`, group `from`/`to`, package `context`.
    - **Cross-package move:** package `from`/`to`.
    - **Same-group move:** writes nothing.
    - `npm run check` passes.

_End of review group 1._

### Review group 2: read side

- [ ] **4. Names for skill-package objects in history**
  - **Files:** `src/lib/schemas/object-history.ts`, `src/server/services/object-history.ts`, `src/server/services/object-history.test.ts`, `src/components/history/object-history.tsx` (the `names` merge only), `src/trpc/routers/history-router.test.ts` (mocked `names`)
  - **Do:**
    - **Schema:**
      - `ObjectHistoryEntry` gains `objectName: z.string().nullable()`, and the generic `ObjectHistoryRef` member gains `name: z.string().nullable()`. Update both JSDocs.
      - Widen `IdFieldTarget`, `IdFields` and `ObjectHistoryPage.names` as in Decisions.
    - **`resolveNames`:**
      - Also collect the page's entry objects (`row.objectType`/`row.objectId`), for `objectName`.
      - For `Skill`/`SkillGroup`/`SkillPackage` entry objects and refs, look up names only for types in `relatedTypes`, and only within the org's own packages.
      - The existing `Skill` `IdFields` lookup has no `relatedTypes` gate, and it also matches subscribed and session-linked skills. If the two share one `findMany`, select the package's `organizationId` and split the results, as `persons` vs `idFieldPersons` does. A subscribed skill's name must never reach `objectName` or a ref `name`.
      - `SkillGroup`/`SkillPackage` `IdFields` ids resolve within the org's own packages.
    - **`listPage`/`toRef`:** fill `objectName` and the generic ref `name`. `listOwn` returns `null` for both.
    - **`object-history.tsx`:** extend the `useMemo` that merges `names` across pages (it builds a `Person`/`Skill` literal), so tsc passes. Build it from `names`' keys if that's simpler. No rendering change here.
  - **Done when:**
    - **Package page:** `ObjectHistory.list` for a `SkillPackage` returns a related `Skill` entry with `objectName` set and a `SkillGroup` ref carrying its `name`.
    - **Gating:** with `Skill`/`SkillGroup` absent from `relatedTypes`, those names come back `null`.
    - **Other orgs:** a skill in another org's package resolves `null`, including one the org subscribes to.
    - **Purged:** a purged skill's entry has `objectName: null`.
    - **IdFields:** a move's `skillGroupId`/`skillPackageId` ids resolve into `names.SkillGroup`/`names.SkillPackage`.
    - **Existing tests:** "keeps refs of other types by id" (`name: null`) and the `listOwn` `names` expectation are updated.
    - `npm run check` passes.

- [ ] **5. Related-entry phrases for skill-package objects**
  - **Files:** `src/lib/diff-format.ts`, `src/lib/diff-format.test.ts`
  - **Do:** add the `relatedActionPhrases` entries from Decisions: `Skill` on `SkillPackage`, `SkillGroup` on `SkillPackage`, and `Skill` on `SkillGroup`. Each covers `Archive`, `Create`, `Delete`, `Move` (Skill only), `Purge`, `Recover`, `Restore` and `Update`.
  - **Done when:** `diff-format.test.ts` covers one phrase from each pair, plus `Move` and `Purge`. `npm run check` passes.

_End of review group 2._

### Review group 3: UI (visual checkpoint)

- [ ] **6. History timeline names skill-package objects** `visual`
  - **Files:** `src/components/history/object-history.tsx`
  - **Do:**
    - **Refs:** `refName` returns the generic ref's `name` when set. `HistoryRef` renders a named generic ref as its type label plus the name as plain text, and an unnamed one as now. A `from`/`to` ref is prefixed "from"/"to".
    - **Phrased related entries:**
      - When the entry type is one `objectName` resolves for (`Skill`/`SkillGroup`/`SkillPackage`), use `entry.objectName` as the sentence's object.
      - When `objectName` is `null` (purged or unviewable), show the bare phrase. Never fall back to ref names for these types.
      - Other types keep today's ref-name fallback.
    - **Unphrased related entries:** append `objectName` after the type when there is one.
    - **Ids:** pass `names.SkillGroup`/`names.SkillPackage` through wherever `names.Skill` goes, so a move's change line reads "Group: Medical → Rescue".
  - **Done when:**
    - On a package's History page, a fresh skill edit reads "Updated skill <name>", with the group named in the details.
    - A move shows on both groups' pages, with from/to visible.
    - `npm run check` passes.

- [ ] **7. Group and skill History pages, menu items, help card** `visual` `mechanical`
  - **Files:**
    - `src/app/(wrapper)/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/history/page.tsx` (new)
    - `src/app/(wrapper)/(authenticated)/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]/history/page.tsx` (new)
    - `src/modules/skill-package-builder/components/group-history-content.tsx` (new)
    - `src/modules/skill-package-builder/components/skill-history-content.tsx` (new)
    - `src/modules/skill-package-builder/components/group-menu.tsx`, `skill-menu.tsx`
    - `content/help/skill-package-builder.mdx`
  - **Do:**
    - **Pages:** copy the package History page (`packages/[package_id]/history/page.tsx`) and `package-history-content.tsx`, following docs/patterns/detail-page-data-fetching.md.
      - Prefetch `getGroup` / `getSkill`, which already include `skillPackage`, so there's no separate `getPackage`. Also prefetch `history.listObjectHistory` with the same input as the client query.
      - Breadcrumbs match the detail page's own, with its last crumb made a link and "History" appended.
      - The skill page's crumbs are Builder › package › "Skills" › name (`skill-content.tsx`). Read the group page's from `group-content.tsx`.
      - Title `${name} — History`, and metadata `${name} History | Skill Package Builder`.
    - **Menus:** add a **History** item to `group-menu.tsx` and `skill-menu.tsx`, the same way `package-menu.tsx` does: a `before` group with a `Link` and `ObjectIcons.History`, then a separator.
    - **Help card:** add **History** to the menu list in `content/help/skill-package-builder.mdx`. It lists every change to the package, including its groups and skills, and groups and skills have their own History. Keep it to two sentences at most, so the card stays under 250 words.
    - Run `npx next typegen` after adding the pages.
  - **Done when:** both new pages render for an existing group and skill, the menus link to them, and `npm run check` passes.

_End of review group 3 (visual checkpoint): the package, group and skill History pages after a few fresh edits, including a move between groups._

## Docs impact

Groups and skills now have History pages, and package History covers changes to them. Guide page: skill-package-builder (History), with new screenshots of a skill's and a package's History page.

## Out of scope

- **Subscribers:** nothing changes on `skill-track/catalogue/[package_id]` (see Decisions).
- **Backfilling refs** on entries written before this branch.
- **Read-time joins** on `Skill.skillPackageId` (rejected in the issue).
- **Linking** skill, group and package names in the timeline to their pages.
- **Rendering reorders** (`arr_ord`) as the new order, in place of "reordered".

## Parked

_(empty)_
