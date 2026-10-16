# Withdraw unpublished packages from subscribers

**Date:** 2026-10-16
**Issue:** [#369](https://github.com/redcloud-nz/avut/issues/369)
**Branch:** `fix/withdraw-unpublished-packages`, worktree `.claude/worktrees/withdraw-unpublished-packages` (dev server on its `.dev-port`)
**DB:** no migration; shared `avut`.
**D4H:** not involved.
**Written against:** integration @ 4246f990

## Decisions

- **A package is _available_ when it's `published` and `Active`.** Only an available package's skills can be assessed or reported on, by every organisation, the author's own included. One predicate expresses this, on the server (a Prisma `where`) and on the client (a function over `SkillPackage`), and every subscriber read uses it.
- **Unpublishing withdraws the skills from existing subscribers** (decided with the user 2026-10-16). Keeping them would need extra UI to show "subscribed, but no longer published". The subscription row is kept, so publishing again brings the skills back, and checks already recorded count again then.
- **Archiving unpublishes,** in the same transaction (decided 2026-10-08). So it leaves the catalogue and can't be subscribed to, as the Archive dialog says. **Restore doesn't republish:** the author publishes again on purpose. `restorePackage` sets `published: false` explicitly, because packages archived before this change can be `Archived` and `published` at once.
- **A subscriber can always find and leave a withdrawn (unpublished or archived) package.** A package in its author's Rubbish bin isn't covered; that's parked. The catalogue list and package page also show packages that this organisation subscribes to and that are withdrawn, marked "Withdrawn". Subscribe is unavailable; Unsubscribe still works.
- **Sessions already holding withdrawn skills keep them.** Nothing is deleted. Recording stays allowed (`setSessionSkillCheck` is unchanged), but the checks don't show in reports while the package is withdrawn. The session pages already put skills outside the assessable set under a fallback group. It gets a clearer label, and the Change Skills dialog lists them so they can be removed. A withdrawn skill can't be _added_ to a session or given a standalone check (`assertAssessableSkills`).
- **Skill- and group-level status is unchanged here.** `listAssessableSkills` still includes Archived skills and groups, while `getCompetencyMatrix` keeps only Active skills. Lining those up is a separate question (parked).

## Tasks

### Review group 1: data layer

- [x] **1. The availability predicate, and archive unpublishes** — feat(skill-package-builder): availability predicate; archive unpublishes
  - **Files:** `src/lib/schemas/skill-package.ts`, `src/server/services/skill-packages.ts`, `src/server/services/skill-packages.test.ts`
  - **Do:**
    - In `skill-package.ts`, add `SkillPackage.isAvailable(pkg: Pick<SkillPackage, "published" | "status">): boolean` (`published && status === "Active"`), and an exported `availableSkillPackageWhere` constant (`{ published: true, status: "Active" } satisfies Prisma.SkillPackageWhereInput`), with a JSDoc on each saying what "available" means (see Decisions). Import only the Prisma _type_, so the file stays client-safe.
    - `archivePackage` sets `published: false` in the same `update` as `status: "Archived"`. Log it as `deletePackage` does: `...(existing.published ? [ctx.logEvent({ action: "Unpublish", … })] : [])` before the `Archive` entry, in the same `$transaction`.
    - `restorePackage` sets `published: false` too, and logs an `Unpublish` entry in the same way when the row was published. Such rows are legacy: archived before this change. `setPackageActive` is shared with `recoverPackage`, so this needs a parameter or a separate write for restore only. A Deleted package is already unpublished.
    - Update both JSDocs.
  - **Done when:** service tests show:
    - archiving a published package leaves it `Archived` and unpublished, with an Unpublish and an Archive entry;
    - archiving an unpublished package writes one Archive entry;
    - restoring an `Archived` + `published` fixture brings it back `Active` and unpublished, with an Unpublish entry.

    `npm run check` passes.

- [x] **2. Subscriber reads use the predicate** — feat(skill-track): subscriber reads use the availability predicate
  - **Files:** `src/trpc/routers/skill-package-subscriptions-router.ts`, `src/server/services/skill-checks.ts`, `src/trpc/routers/skill-checks-router.ts`, and their tests (`skill-package-subscriptions-router.test.ts`, `skill-checks.test.ts`, `skill-checks-router.test.ts`). Task 3 covers `listPackages` and `getPackage`.
  - **Do:**
    - `listAssessableSkills`, `listSubscribedPackages`, and `assertAssessableSkills` filter the package with `availableSkillPackageWhere`, instead of `status: { not: "Deleted" }`. Update `assertAssessableSkills`'s JSDoc and its error message ("…from an available package this organisation subscribes to").
    - `subscribeToPackage` rejects a package that isn't available, with NOT_FOUND as now.
    - `getCompetencyMatrix` uses `SkillPackage.isAvailable(pkg)` in place of its inline `status !== "Active" || !published` check. No behaviour change.
    - Keep procedures in alphabetical order.
  - **Done when:**
    - **`listAssessableSkills` and `listSubscribedPackages`:** tests cover a subscribed package that is unpublished, and one that is Archived. Both are excluded.
    - **`assertAssessableSkills`** (and `createSkillCheck`, through it) rejects a skill from an unpublished subscribed package.
    - **`subscribeToPackage`** rejects an Archived package that is still `published`, a legacy fixture.
    - `npm run check` passes.

- [x] **3. Subscribers can still see withdrawn packages in the catalogue** — feat(skill-track): catalogue shows subscribers their withdrawn packages
  - **Files:** `src/trpc/routers/skill-package-subscriptions-router.ts`, `src/trpc/routers/skill-package-subscriptions-router.test.ts`
  - **Do:**
    - `listPackages`: the `where` becomes `OR: [availableSkillPackageWhere, { status: { not: "Deleted" }, subscriptions: { some: { organizationId } } }]`. The catalogue then also lists withdrawn packages this organisation still subscribes to. `getPackage` gets the same `where`, so a subscriber can open a withdrawn package and unsubscribe. A non-subscriber still gets NOT_FOUND for one. Update both JSDocs.
  - **Done when:**
    - **`listPackages` and `getPackage`** return an unpublished package to a subscriber, but not to a non-subscriber. The existing "throws NOT_FOUND for an unpublished package" test stays, as the non-subscriber case.
    - `npm run check` passes.

- [x] **4. Builder effects and menu** — feat(skill-package-builder): builder mutations refresh subscriptions; Publish only for Active `mechanical`
  - **Files:** `src/client/skill-package-builder-effects.ts`, `src/modules/skill-package-builder/components/package-menu.tsx`
  - **Do:**
    - The builder effects for `archivePackage`, `restorePackage`, `publishPackage`, `unpublishPackage` and `deletePackage` also invalidate `skillPackageSubscriptions` (the router-level filter, `trpc.skillPackageSubscriptions.pathFilter()`), because the author's own organisation may subscribe to its package.
    - In `package-menu.tsx`, show **Publish** only when `status === "Active" && !published`. `publishPackage` already rejects anything else.
  - **Done when:** `npm run check` passes.

_End of review group 1._

### Review group 2: UI (visual checkpoint)

- [x] **5. Catalogue shows withdrawn packages** — feat(skill-track): catalogue marks withdrawn packages; unsubscribing leaves the page `visual`
  - **Files:** `src/modules/skill-track/components/catalogue-packages-list.tsx`, `src/modules/skill-track/components/catalogue-package-content.tsx`
  - **Do:**
    - **List:** the status column is plain text today (`"Subscribed"`). A package where `!SkillPackage.isAvailable(pkg)` shows "Subscribed · Withdrawn" there, as text.
    - **Package page:** the same badge. Add a short note: "Its author has withdrawn this package. Its skills are out of your sessions and reports until it's published again. Checks already recorded are kept." Hide the Subscribe action, and keep Unsubscribe.
    - Use `Badge` as the page already does. No new layout.
    - **Leaving a withdrawn package:** once the subscriber unsubscribes, they can no longer see the package (`getPackage` returns NOT_FOUND). So when it isn't available, the Unsubscribe dialog's `onSuccess` navigates back to `/orgs/[slug]/skill-track/catalogue`.
  - **Done when:** a subscriber sees the badge and note on an unpublished package, can unsubscribe, and lands back on the catalogue list. `npm run check` passes.

- [x] **6. Sessions holding withdrawn skills** — feat(skill-track): sessions list withdrawn skills under "No longer available" `visual`
  - **Files:** `src/modules/skill-track/components/change-session-skills.tsx`, `src/modules/skill-track/components/session-by-skill-content.tsx`, `src/modules/skill-track/components/session-by-person-content.tsx`
  - **Do:**
    - **`change-session-skills.tsx`:** add a final section, "No longer available", listing the assigned skills that aren't in `listAssessableSkills` (from `listSessionSkills` `assigned`). Their checkboxes can be unticked, which removes them through `removedSkillIds`. Once unticked, a skill stays listed, so the change can be undone before Save. Adding it back works only before Save; the server would reject it afterwards.
    - **The empty-state text** shows only when there are no sections at all, including this one.
    - **By-skill and by-person pages:** the fallback group label "Other" becomes "No longer available", and only that label changes.
  - **Done when:** a session holding a skill from an unpublished package lists it under "No longer available" on both pages and in Change Skills, and it can be removed there. `npm run check` passes.

- [x] **7. Dialog wording and help cards** `visual` `mechanical` — docs(skill-package-builder): dialogs and help cards describe withdrawal
  - **Files:**
    - `src/modules/skill-package-builder/components/unpublish-package.tsx`
    - `src/modules/skill-package-builder/components/archive-package.tsx`
    - `content/help/skill-package-builder.mdx`
    - `content/help/skill-track/catalogue.mdx`
  - **Do:**
    - **Unpublish dialog:** "Unpublish package {name}. It leaves the catalogue, and organisations subscribed to it lose its skills from their sessions and reports until you publish it again. Their recorded checks are kept."
    - **Archive dialog:** "Archive package {name}. Archiving also unpublishes it: it leaves the catalogue, and subscribers lose its skills from their sessions and reports. Restoring it doesn't publish it again."
    - **Help cards:** both describe the new behaviour, following `content/README.md`:
      - in the builder card, Unpublish and Archive both withdraw the skills, and Restore doesn't republish;
      - in the catalogue card, withdrawn packages are marked, and they can still be unsubscribed from.
  - **Done when:** `npm run check` passes (content collections build).

_End of review group 2. Visual checkpoint: the catalogue, a session's by-skill page, the Change Skills dialog, and the two builder dialogs._

## Docs impact

Unpublishing and archiving a skill package now withdraw its skills from subscribers, and archiving also unpublishes. Withdrawn packages show as "Withdrawn" in the catalogue, and sessions list their skills under "No longer available". Pages: `content/docs/skill-package-builder/index.mdx` (drop the warning Callout about the dialogs), `content/docs/skill-track/catalogue.mdx`. Screenshots: the Unpublish and Archive dialogs, and the catalogue list if it's shot with a withdrawn package.

## Out of scope

- Keeping skills for existing subscribers after unpublishing (decided against).
- Blocking check recording for withdrawn skills already in a session.

## Parked

- `listAssessableSkills` and `assertAssessableSkills` include Archived skills and groups, while `getCompetencyMatrix` reports only Active skills. Decide whether Archived skills should be assessable.
- Re-import unpublishes a published package (`prepareImport` sets `published: false` on update), which withdraws it from subscribers without warning.
- `listSubscribedPackages` has no UI caller.
- A package in its author's Rubbish bin (Deleted, so unpublished) is invisible to its subscribers, who can't unsubscribe from it. Recorded checks from other organisations block its purge (`otherOrgCheckBlocker`), so it can stay there indefinitely.

## Review notes

- [x] `src/client/skill-package-builder-effects.ts` `recoverPackage`: also invalidate `trpc.skillPackageSubscriptions.pathFilter()`, like the other five package-lifecycle effects (task 4).
- [x] Tests seed branded ids with `nanoId16()`: `src/server/services/skill-checks.test.ts` (subscription `id`) and `src/trpc/routers/skill-package-subscriptions-router.test.ts` (`user`). Use `SkillPackageSubscriptionId.create()` / `UserId.create()` (tasks 2, 3).
- [x] `src/modules/skill-track/components/catalogue-package-content.tsx`: show the "Subscribed · Withdrawn" badge only when `withdrawn && skillPackage.subscription`, so it doesn't flash after unsubscribing (task 5).
