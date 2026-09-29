# Plan: session config dialogs + Actions sheet for skill check entry pages

**Date:** 2026-09-29
**Issue:** [#323](https://github.com/redcloud-nz/avut/issues/323)
**Branch:** `feat/session-config-sheet` (renamed from `plan/session-config-sheet` at pickup)
**Worktree:** `.claude/worktrees/session-config-sheet`
**DB:** no migration. Shared `avut` is fine, and no `db:branch` is needed.
**D4H:** nothing here depends on a D4H token. Teams, personnel and skills are all local, so
the no-token case needs no handling.
**Written against:** integration @ 725ca99e (first written against cef534bd, re-reviewed at pickup)

Changing a session's personnel, skills or assessors today means leaving the recording
screen. This adds an **Actions** button to the `by-person`/`by-skill` navbars. It opens a
right-side sheet with three "change X" dialogs and a By Person / By Skill switch. It also
retires the standalone `…/personnel` and `…/skills` pages in favour of the same dialogs,
which the session detail page's Contents card opens.

## Decisions

- **Change assessors offers recorders only.** A candidate is an `Active` person in the org
  whose linked `OrganizationUser` holds a role that authorizes `skillCheck: ["create"]`
  (only `skills-assessor` today). The check is
  `hasAnyRoleWithPermissions(parseStoredRoles(ou.role), { skillCheck: ["create"] })` from
  `src/lib/permissions.ts`, not a hard-coded role name. The server enforces it too: an
  added id that isn't eligible is rejected. Removal is never validated, so an assessor
  who has since lost the role can still be taken off.
- **Currently assigned but ineligible assessors still show** in the dialog, ticked, with a
  "can't record checks" hint, so they can be removed. They are never offered to anyone
  who isn't already assigned.
- **Eligibility lives in the service layer** as `SkillChecks.listEligibleAssessors(ctx)`
  in `src/server/services/skill-checks.ts`. The new list query and the new mutation's
  validation both call it (per `src/server/services/CLAUDE.md`). The list query is gated
  on `skillCheckSession: ["view"]`, not `member: ["view"]`. `skills-assessor` and
  `skills-admin` lack `member` and must still see the candidates.
- **`updateSessionAssessors` requires `skillCheckSession: ["update"]`**, the same as
  `updateSessionAssessees`/`updateSessionSkills`. The comment above
  `upsertSessionSkillChecks` already assumes `skills-admin` can add itself as an assessor
  and is held back from recording by the `skillCheck` half.
- **Self-removal is allowed, with a warning.** If the current user's own person is
  unticked, and they are eligible, the assessors dialog shows an inline warning saying they
  won't be able to record in this session. An ineligible self row, such as a
  `skills-admin` whom `createSession` made assessor, gets no warning, since they couldn't
  record anyway: the entry page already shows it the "Cannot record skill checks" alert,
  and the dialog's "can't record checks" hint matches that wording. Saving still works.
  Once removed, the entry page shows its "Not an assigned assessor" alert, whatever the
  user's role.
- **The dialogs stage changes.** Save and Cancel go in the footer, per
  `docs/patterns/mutation-dialog.md`, with no autosave or debounce. Save sends the
  existing `added…Ids`/`removed…Ids` shape and is disabled until something has changed.
- **The standalone pages are retired.** `sessions/[session_id]/personnel` and
  `…/skills` are deleted along with `session-personnel-content.tsx` and
  `session-skills-content.tsx`. Their tree-building (team → members, package → group →
  skills) moves into the dialog bodies rather than being duplicated. The skills page's
  "Show Skill Description" toggle comes along as a checkbox in the skills dialog header.
- **One host owns the three dialogs.** `SkillTrack_SessionConfigDialogs` owns the
  `?action=` param with the literals `change-personnel` / `change-skills` /
  `change-assessors` (precedent: `change-email`) and renders three host-driven dialogs
  (Recipe C in the pattern doc). It also exports a small hook for triggers to open one.
  It's mounted once on each page that can open them: `by-person`, `by-skill` (inside the
  sheet component) and the session detail page. It doesn't clash with `session-menu`
  (`delete`) or `update-session` (`update`) on the detail page.
- **The sheet is local state, not a URL param.** It's a menu, and `?action=` can only hold
  one value, which the dialog it opens needs. Choosing a "change X" item closes the sheet
  and pushes `?action=change-X`. `SkillTrack_SessionConfigDialogs` renders outside
  `SheetContent`, since anything inside unmounts when the sheet closes. Radix won't return
  focus on its own: the dialog would record the vanished sheet item as its return target.
  Focus is returned explicitly to the Actions button (see task 4).
- **Gating:** the Actions button is visible to anyone on the entry page, since the mode
  switch is useful to everyone. The three "change X" items use
  `<Protect permissions={{ skillCheckSession: ["update"] }} render=…>` and render disabled
  without it (`docs/patterns/protect-permission-gating.md`). On the detail page, a Contents
  row is a button for updaters and plain text for everyone else.
- **Mode switch = two links** (By Person / By Skill) in the sheet, with the current one
  marked `aria-current="page"`. That's a client-side `<Link>` navigation, not a full page
  load.
- **Data loads lazily.** Each dialog body sits behind `DialogBoundary` and uses
  `useSuspenseQueries`. The entry and detail `page.tsx` files prefetch the dialog's queries
  only when `searchParams.action` names that dialog (pattern doc, "Prefetch a dialog's list
  only when…").

## Tasks

- [x] **1. `listEligibleAssessors` + `updateSessionAssessors` (service, router, tests)** — feat(skill-track): add listEligibleAssessors and updateSessionAssessors
  - **Files:** `src/server/services/skill-checks.ts`, `src/server/services/skill-checks.test.ts`,
    `src/trpc/routers/skill-check-sessions-router.ts`,
    `src/trpc/routers/skill-check-sessions-router.test.ts`, `src/trpc/messages.ts` (if a new
    message is needed)
  - **Do:** - `SkillChecks.listEligibleAssessors(ctx: OrgServiceContext): Promise<PersonRef[]>`:
    `Active` personnel in `ctx.organizationId` with a linked `organizationUser` whose
    `role` passes `hasAnyRoleWithPermissions(parseStoredRoles(role), { skillCheck:
["create"] })`, sorted by name. Filter roles in JS after one Prisma query that selects
    `id`, `name` and `organizationUser.role`. - Router `listEligibleAssessors: organizationProcedure({ skillCheckSession: ["view"] })`,
    with input `{}` (org id comes from the procedure) and output `z.array(PersonRef.schema)`.
    It calls the service. - Router `updateSessionAssessors: organizationProcedure({ skillCheckSession: ["update"] })`
    mirrors `updateSessionAssessees`. The input is `{ skillCheckSessionId,
addedPersonIds, removedPersonIds }`. It calls `SkillChecks.requireSessionById`, then
    rejects any `addedPersonIds` entry not in `listEligibleAssessors` with a
    `ValidationError` (`src/lib/errors.ts`, mapped by the service-error middleware). It
    pairs the `connect`/`disconnect` update with `ctx.logEvent` (`arr_add`/`arr_del` on
    `path: ["assessors"]`) in `ctx.prisma.$transaction([...])`
    (`docs/patterns/transactional-writes.md`). The output is `{ updatedAssessors:
PersonRef[], updatedSession: SkillCheckSession }`.
  - **Done when:** tests (following `.claude/rules/testing.md`) cover four things.
    (a) The service returns only Active, linked `skills-assessor` people. It excludes an
    unlinked person, a linked `member`-only person, a linked `skills-admin`, an archived
    person, and another org's person. (b) The mutation adds an eligible person and removes
    an assigned one, and writes a log entry. Also cover an eligible multi-role value such as
    `"member,skills-assessor"`, so the `parseStoredRoles` path is exercised. (c) It rejects adding an ineligible person with
    `BAD_REQUEST` and changes nothing. (d) It allows removing an assessor who is no longer
    eligible. `npm run check` passes.

- [x] **2. Personnel + skills dialogs and the config-dialogs host** `visual` — feat(skill-track): add session personnel and skills dialogs with config-dialogs host
  - **Files (new):** `src/components/skill-track/session-config-dialogs.tsx`,
    `src/components/skill-track/change-session-personnel.tsx`,
    `src/components/skill-track/change-session-skills.tsx`
  - **Do:** Follow `docs/patterns/mutation-dialog.md`, specifically the host-driven
    relationship dialog (Recipe C) and the "dialog that loads its own data" section
    (`DialogBoundary`, `useSuspenseQueries` in a child body, local state in the child, and
    `onDone` to close). - `SkillTrack_ChangeSessionPersonnel_Dialog({ sessionId, open, onOpenChange })`. The
    body fetches `listSessionAssessees({ scope: "assigned" })`, `teams.listTeams` and
    `teams.listTeamMemberships`, and renders the team → member collapsible checklist
    moved from `session-personnel-content.tsx`. Changes are staged in a
    `Record<PersonId, boolean>`. Save calls `updateSessionAssessees` with
    `meta.effects: skillCheckSessionsEffects.updateSessionAssessees`, toasts on
    success/error, and closes. A person on more than one team toggles in every section,
    because state is keyed by person id as it is today. - `SkillTrack_ChangeSessionSkills_Dialog`: the same shape, over
    `listAssessableSkills` + `listSessionSkills({ scope: "assigned" })` and
    `updateSessionSkills`. It carries the package → group → skill tree and the "Show
    skill descriptions" toggle, a `Checkbox` in the dialog header or top of the body. - `SkillTrack_SessionConfigDialogs({ sessionId })` owns
    `useQueryState("action", parseAsStringLiteral(["change-personnel", "change-skills",
"change-assessors"] as const))`, with push on open and replace on close. It renders
    the two dialogs, plus the assessors slot that task 3 fills. Export
    `useSessionConfigAction()` so triggers elsewhere can `open("change-skills")` without
    re-declaring the literals.
  - **Done when:** each dialog opens from a URL (`?action=change-personnel`,
    `?action=change-skills`), is full-screen below `sm`, and has a scrolling body with a
    fixed footer. Cancel discards the staged ticks. Save persists them and closes.
    `npm run check` passes. It isn't mounted anywhere yet; tasks 4 and 5 mount it, and the
    "page behind updates without a reload" checks live in those tasks. Leave the visual
    check for the checkpoint.

- [x] **3. Assessors dialog + cache effects** `visual` — feat(skill-track): add session assessors dialog and cache effects
  - **Files:** `src/components/skill-track/change-session-assessors.tsx` (new),
    `src/components/skill-track/session-config-dialogs.tsx`,
    `src/client/skill-check-sessions-effects.ts`
  - **Do:** - Add an `updateSessionAssessors` effect. It writes `getSession` (merging
    `updatedSession` and `assessors: updatedAssessors` into the cached value), writes
    `listSessionAssessors({ scope: "assigned" })`, invalidates
    `listSessionAssessors({ scope: "all" })`, and invalidates `listSessions` (its rows
    carry `assessors`). - `SkillTrack_ChangeSessionAssessors_Dialog`: the same shape as task 2. The body fetches
    `listEligibleAssessors`, `listSessionAssessors({ scope: "assigned" })` and
    `personnel.getPersonSelf`. It's a flat, name-sorted checklist of eligible ∪ assigned
    people. Assigned-but-ineligible rows carry a muted "can't record checks" description.
    If `personSelf` is currently assigned, can record (`useHasPermission({ skillCheck:
["create"] })`, the same check the entry pages' `canRecordChecks` uses), and is staged
    as unticked, it shows an inline warning `Alert` ("You won't be able to record checks in this session"). An empty
    eligible list shows an `Empty` state explaining that assessors need the Skills
    Assessor role and a linked person. - Wire it into `SkillTrack_SessionConfigDialogs`.
  - **Done when:** it opens at `?action=change-assessors`, and the Task 1 procedures
    round-trip through it. `npm run check` passes. The live effect on the entry page is
    checked in task 4.

- [x] **4. Actions sheet on `by-person` / `by-skill`** `visual` — feat(skill-track): add Actions sheet to the session entry pages
  - **Files:** `src/components/skill-track/session-actions-sheet.tsx` (new),
    `src/components/skill-track/session-by-person-content.tsx`,
    `src/components/skill-track/session-by-skill-content.tsx`, and both entry pages'
    `page.tsx` (conditional prefetch)
  - **Do:**
    - `SkillTrack_SessionActionsSheet({ sessionId, mode: "by-person" | "by-skill" })`
      renders an "Actions" navbar `Button` (icon + label, label `sr-only` below `sm`) and a
      `Sheet` held in local `useState`. Build the sheet shell after `HelpSheet`
      (`src/components/docs/help-sheet.tsx`): `side="right"`, `SheetHeader` with title and
      description, and a scrolling body. It has two groups. **Configure** holds Change
      personnel / Change skills / Change assessors, each gated via `Protect`'s `render`
      prop as disabled-without-permission. Selecting one closes the sheet and calls
      `open(...)` from `useSessionConfigAction`. **Record** holds a By Person / By Skill
      `<Link>` for each, with the current `mode` marked. The component also mounts
      `SkillTrack_SessionConfigDialogs` as a sibling of the `Sheet`, not inside
      `SheetContent`.
    - **Focus return:** keep a ref to the Actions button. Pass it through
      `SkillTrack_SessionConfigDialogs` (an optional `returnFocusRef` prop) to each dialog.
      In each dialog's `DialogContent` `onCloseAutoFocus`, call `preventDefault()`, then
      `returnFocusRef?.current?.focus()`. On the detail page, where no ref is passed, the
      dialogs keep Radix's default. See `docs/patterns/mutation-dialog.md`, "Menu-triggered
      dialogs and focus".
    - Put it in both entry pages' navbar button row, between `SaveStatusIndicator` and
      `HelpButton`.
    - When a save removes the currently selected person (by-person) or skill (by-skill) from
      the session, the page must stop showing it. Derive this rather than wiring a callback:
      treat `selected` as `null` when its id is no longer in `assignedPersonnel` /
      `sessionSkills`, which the effects already write. Pending debounced check edits still
      flush, since `upsertSessionSkillChecks` doesn't check assignee membership, as today.
    - Each entry `page.tsx` reads `searchParams.action` and prefetches only that dialog's
      queries.
  - **Done when:** from each entry page, every sheet item works. A "change X" item closes
    the sheet and opens its dialog, and focus returns to the Actions button on close. The
    mode links switch pages client-side. A user without `skillCheckSession: ["update"]`
    sees the three items disabled. A config change reflects in the page behind without a
    reload. Adding a person or skill shows it in the picker. Removing the selected one
    drops back to the empty state. As a `skills-assessor`, adding yourself as assessor on a
    session you weren't assessing turns the "Not an assigned assessor" alert into the
    recording UI, and removing yourself does the reverse. As a `skills-admin` who is an
    assigned assessor, the entry page shows "Cannot record skill checks"; your row in the
    assessors dialog carries the "can't record checks" hint and no self-removal warning, and
    unticking and saving turns the alert into "Not an assigned assessor". `npm run check`
    passes.

- [x] **5. Session detail page opens the dialogs; retire the standalone pages** `visual` — feat(skill-track): open session config dialogs from the detail page and retire the standalone pages
  - **Files:** `src/components/skill-track/session-contents.tsx`,
    `src/components/skill-track/session-content.tsx`, the detail `page.tsx` (conditional
    prefetch), `docs/modules/skills.md` (route table rows for the retired pages). **Delete** `…/sessions/[session_id]/personnel/page.tsx`,
    `…/sessions/[session_id]/skills/page.tsx`,
    `src/components/skill-track/session-personnel-content.tsx` and
    `src/components/skill-track/session-skills-content.tsx`.
  - **Do:** Mount `SkillTrack_SessionConfigDialogs` in `SkillTrack_Session_Content`.
    In the Contents card, make the Personnel and Skills rows open their dialogs, and add an
    **Assessors** row that opens the assessors dialog. Take its count from
    `session.assessors.length` (`getSession` is already loaded, and the Task 3 effect
    writes `assessors` into it). Don't add a query that the page doesn't prefetch. Updaters get an `Item` rendered as a `<button>` (keep the
    chevron). Everyone else gets a plain `Item` with no chevron (`Protect` `render`).
    Skill checks stays a link. Delete the two pages and content components, and drop their
    rows from the route table in `docs/modules/skills.md`. Run `npx next typegen` and
    confirm nothing else references the removed routes (`grep -rn
"sessions/\[session_id\]/\(personnel\|skills\)" src docs content`, ignoring
    `docs/plans/` and `docs/reviews/`).
  - **Done when:** the detail page's three Contents rows open the right dialogs, counts
    update after a save, and the old URLs 404. `npm run check` passes with regenerated
    route types.

  **Visual checkpoint** after this task, covering tasks 2–5 together: both entry pages
  (sheet, three dialogs, mode switch, phone width), and the detail page.

- [ ] **6. End-user docs**
  - **Files:** `content/docs/skill-track/sessions.mdx`
  - **Do:** Rewrite steps 1–3. The Contents card rows (Personnel, Skills, Assessors) now
    open dialogs where you tick and then **Save**, instead of autosaving pages. Add a short
    subsection under step 4 on the **Actions** sheet: changing personnel, skills or
    assessors mid-session, and switching between By Person and By Skill. Adjust the
    recording `Callout` to say that anyone with session update access can add assessors
    from the sheet.
    - **Screenshots:** `getScreenshot` (`src/lib/screenshots.ts`) throws at request time on
      an id missing from `src/lib/screenshots.generated.json`. So the implementer must not
      reference new ids. It removes the two retired `<Screenshot>`s
      (`skill-track/session-skills`, `skill-track/session-personnel`) and lists the
      wanted captures in its report: the skills dialog, the personnel dialog, the assessors
      dialog and the Actions sheet. The main session then captures and uploads them with
      the `avut-doc-screenshots` skill and adds the `<Screenshot>`s in the same commit that
      adds their ids to `screenshots.generated.json`.
  - **Done when:** `npm run check` passes and no step describes the retired pages. Every
    `<Screenshot id>` in `content/docs/skill-track/sessions.mdx` exists in
    `src/lib/screenshots.generated.json`. `/docs/skill-track/sessions` and the entry pages'
    `?help=skill-track/sessions` sheet render without error.

## Out of scope

- The single-entry recording mode, and anything from #322 (per-check recording dialog).
  The sheet's Record group is built so a third mode link can be added.
- Locking config changes on an approved session. That belongs with #320's approval lock,
  not here.
- Validating that `updateSessionAssessees`'s added ids are org personnel. That's a
  pre-existing gap and worth its own issue, since the assessors mutation added here does
  validate.
- Editing session name/date/notes from the sheet. That's still the detail page's update
  dialog.
- Persisting the "show skill descriptions" toggle.
