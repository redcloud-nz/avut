# Plan: per-check recording dialog and Quick Mode for skill check sessions

**Date:** 2026-09-29
**Issue:** [#322](https://github.com/redcloud-nz/avut/issues/322)
**Branch:** `feat/check-recording-dialog`, off `integration`. #323 (session config sheet,
PR #338) and the dialog `size` prop (PR #334) have both merged.
**Tracking:** Stage 0 of [#336](https://github.com/redcloud-nz/avut/issues/336).
**Worktree:** `.claude/worktrees/check-recording-dialog` (dev server port in `.dev-port`)
**DB:** no migration. Shared `avut` is fine, and no `db:branch` is needed.
**D4H:** nothing here depends on a D4H token.
**Written against:** integration @ 725ca99e (+ the two branches above); refreshed at pickup
against integration @ 2adbe211

The `by-person`/`by-skill` recording pages use tap-to-cycle rows (`assessment-row.tsx`)
and a debounced batch autosave (`upsertSessionSkillChecks`, with a `changes` overlay and a
"did it still match what I sent" merge). This replaces both with two switchable recording
modes over one dialog. Every tap commits a single check atomically.

- **Quick Mode** (default). Each row has `Fail`, `Pass` and `More` buttons. Tapping Fail or
  Pass records the family's mid tier at once. Tapping the active one clears the check.
  `More` opens the dialog already expanded.
- **Dialog mode**. Each row shows a result badge and an edit/add button, which opens the
  dialog **compact**: one button per enabled result, where a tap commits and closes.
  **Expand** turns the same instance into a full form, with the result buttons staged,
  notes, and Cancel / Delete / Save.

## Decisions

- **New session-scoped mutations, not `createSkillCheck`/`updateSkillCheck`/`deleteSkillCheck`.**
  `skills-assessor` holds `skillCheck: ["view", "create"]` and no `delete`
  (`src/lib/permissions.ts`), so `deleteSkillCheck` would reject assessors.
  `createSkillCheck` would also race a double tap on the
  `(assesseeId, assessorId, sessionId, skillId)` unique key. So the sessions router gains
  `setSessionSkillCheck` (upserts one check on that key) and `deleteSessionSkillCheck`
  (deletes the caller's own check on that key). Both carry `upsertSessionSkillChecks`'s
  gate, `{ skillCheckSession: ["update"], skillCheck: ["create"] }`. The assessor is
  always the caller's linked person, derived server-side. The client never holds a
  check id, so there's no create-vs-update branch. #320's approval-lock guard will need
  adding to these two procedures instead of to the batch upsert.
- **The new procedures key the session as `skillCheckSessionId`, not `sessionId`.** #328
  (scoped access codes) standardises the session router's inputs on `<kind>Id`, so new
  procedures start there rather than adding two more to rename. Only the input key changes:
  the Prisma column and the unique key stay `sessionId`, and client hooks keep their own
  `sessionId` parameter names.
- **They validate what the batch upsert didn't.** A single check is cheap to check, so
  both reject (`BAD_REQUEST`) an assessee who isn't on the session's assessees, or a skill
  that isn't in its skills. A late tap after a config change then fails loudly rather than
  writing an orphaned check.
- **`upsertSessionSkillChecks` is removed** once nothing calls it (task 7). The two entry
  pages are its only callers.
- **The dialog is `Dialog`, not `AlertDialog`.** Outside-click and Escape dismiss it. Below
  `sm` it's a bottom sheet as tall as its content, not full screen. `DialogContent` gains a
  `mobile?: "fullscreen" | "sheet"` prop (default `"fullscreen"`, which changes nothing)
  alongside `feat/wider-dialogs`' `size` prop. `"sheet"` reuses `AlertDialogContent`'s
  bottom-sheet classes (`src/components/ui/alert-dialog.tsx`).
- **The dialog is local state, not a `?action=` param.** It opens once per row, many times
  per session, and targets an (assessee, skill) pair. A URL entry for each would flood
  history, and the page's picker selection isn't in the URL either. Each page holds one
  `target` state (`{ assesseeId, skillId, density: "compact" | "expanded" } | null`) and
  renders **one** dialog instance, not one per row.
- **Compact commits and closes right away.** Tapping a result fires `setSessionSkillCheck`
  (keeping existing notes) and closes the dialog without waiting. Expanded stages the
  result and notes. **Save** fires the mutation and closes. It's disabled until something
  changed and while no result is selected. **Delete** fires `deleteSessionSkillCheck` and
  closes. **Cancel** discards. Tapping the current result in compact state does nothing
  and closes.
- **Delete has no confirm step, and its toast offers Undo.** Deletion is a hard delete
  until #319 lands. The success toast, from every delete path (dialog Delete and a Quick
  Mode retap), carries an **Undo** action that calls `setSessionSkillCheck` with the
  deleted check's result and notes.
- **Pending state comes from TanStack Query, not a hand-rolled overlay.** Each entry page
  calls `usePendingChecks(sessionId)` once, at the top level. It's one `useMutationState`
  call that returns a map from `${assesseeId}::${skillId}` to the pending result (`null` for
  a pending delete). `renderRow` looks each row up in the map and passes a plain `pending`
  prop. No hook is called per row, because rows are rendered from `.map()` callbacks and the
  docs demo renders the row without tRPC. While a row is pending, the
  row shows the pending value at reduced opacity and disables its buttons. That stops two
  writes to one key from reordering on the server. On success the effect writes the cache.
  On error a toast shows and the row falls back to the cached value.
- **Quick Mode buttons.**
  - The Fail button records `Fail`, or the first enabled fail tier if `Fail` is disabled
    for the org. The Pass button does the same with `Pass`. A family with no enabled tier
    has no button.
  - A button is **active** when the check's result is in its family. A family means all
    three of its tiers, whether or not each is enabled for the org. The button then shows that
    exact tier's icon (as today's `failPreview`/`passPreview` do), with `variant="outline"`.
  - Tapping an **inactive** button records the mid tier, keeping existing notes.
  - Tapping an **active** button clears the check if it has no notes. If it has notes, the
    dialog opens expanded instead, so the notes are visible and Delete is a deliberate
    choice.
  - A result outside both families (`NotTaught`, `Exempt`, `Expired`, `Provisional`)
    shows its label in place of both buttons, as today, with `More` still beside it.
  - A check with notes shows a small notes icon (`MessageSquareTextIcon`, muted,
    `aria-label="Has notes"`) before the buttons, in both modes.
- **Compact layout.** The enabled results are laid out in up to three rows of buttons, each
  with icon and label: the fail tiers, the pass tiers, then everything else (`NotTaught`,
  `Exempt`, `Expired`, `Provisional`), in `SKILL_CHECK_RESULT_VALUES` order. Empty rows are
  omitted. The check's current result is always included, even if the org has since
  disabled it, so an existing check never loses its active button. The expanded state shows
  the same buttons, with the staged one marked
  (`variant="outline"` + `aria-pressed`), above a notes `Textarea`.
- **The mode is remembered per browser.** It's a `"quick" | "dialog"` choice in the Actions
  sheet's **View** group, next to Skill Order. It lives in `localStorage` under
  `avut:skill-track:recording-mode`, shared by both entry pages, and defaults to `"quick"`.
  No hook for this exists yet. Add `useLocalStorageState` (task 6), built on
  `useSyncExternalStore`, whose server snapshot is the default. It's restricted to string
  values, so its snapshot is stable without caching a parse. That makes it SSR-safe with
  no hydration mismatch, and it falls back to the default when a stored value fails the
  zod schema.
- **The navbar's `SaveStatusIndicator` is removed** from both entry pages. With no batch
  there's no one save status, and pending and error are shown per row. The component and
  `@tanstack/react-pacer` stay, since `i3` still uses both.
- **Permissions don't change.** The pages already gate recording on assigned-assessor +
  `useHasPermission({ skillCheck: ["create"] })`, which matches both new procedures once
  the session-update half is added. `skills-assessor` holds `skillCheckSession: ["update"]`,
  so the check stays `skillCheck: ["create"]`. The comments that cite
  `upsertSessionSkillChecks` as the reason (both entry pages, `change-session-assessors.tsx`)
  are updated to cite the new procedures.
- **The visual checkpoint replaces the issue's scratch mock-up.** The issue suggested
  mocking both modes in `orgs/[slug]/system/scratch/` first. The mutations are small, so the
  real pages are built directly, and the look and feel is steered at the task 6 checkpoint
  instead.
- **Status is untouched.** As with the batch upsert, a created check takes the Prisma default
  `status` (`Draft`), and an update doesn't reset it. So re-recording an approved check keeps
  `Include`/`Exclude`. Locking approved sessions belongs to #320.

## Tasks

- [x] **1. `setSessionSkillCheck` + `deleteSessionSkillCheck` (service, router, tests)** — feat(skill-track): add setSessionSkillCheck and deleteSessionSkillCheck
  - **Files:** `src/server/services/skill-checks.ts`, `src/server/services/skill-checks.test.ts`,
    `src/lib/errors.ts`, `src/trpc/init.ts`,
    `src/trpc/routers/skill-check-sessions-router.ts`,
    `src/trpc/routers/skill-check-sessions-router.test.ts`
  - **Do:**
    - Add `ForbiddenError` to `src/lib/errors.ts`, next to `NotFoundError`, and a
      `FORBIDDEN` branch for it in `mapDomainErrors` (`src/trpc/init.ts`). No domain error
      maps to `FORBIDDEN` today.
    - Add a service function,
      `SkillChecks.requireSessionAssessor(ctx: OrgServiceContext, sessionId): Promise<{ session; assessorId: PersonId }>`.
      It loads the session with its
      assessors, assessees and skills (ids only), throwing `NotFoundError` if the session is
      missing. It resolves the caller's linked `organizationUser.personId`, throwing
      `ValidationError` if there isn't one, and `ForbiddenError` if that person isn't an
      assessor. A service can't import `src/trpc/`, so it uses local message literals worded
      like `Messages.noLinkedPersonRecord()` / `Messages.notSessionAssessor()`
      (precedent: `src/server/services/skill-packages.ts:32`).
    - Router
      `setSessionSkillCheck: organizationProcedure({ skillCheckSession: ["update"], skillCheck: ["create"] })`,
      with input
      `{ skillCheckSessionId, assesseeId, skillId, result: SkillCheckResultValue.schema, notes: z.string() }`
      and output `SkillCheck.schema`. It
      calls `requireSessionAssessor`, then rejects with `ValidationError` (→ `BAD_REQUEST`)
      an `assesseeId` not in the session's assessees or a `skillId` not in its skills. Then
      it runs `ctx.prisma.skillCheck.upsert` on
      `assesseeId_assessorId_sessionId_skillId`: create with a fresh `SkillCheckId.create()`,
      update `result` + `notes`. It returns `SkillCheck.fromRecord`. Create sets `id`,
      `organizationId`, `sessionId`, `assesseeId`, `assessorId`, `skillId`, `result` and
      `notes`, with no `status` (the Prisma default, `Draft`), exactly as the upsert does.
    - Router `deleteSessionSkillCheck`, with the same gate, input
      `{ skillCheckSessionId, assesseeId, skillId }` and output `z.object({ deleted: z.boolean() })`. It runs the same two
      checks, then `deleteMany` scoped to `organizationId`, `sessionId`, `assesseeId`,
      `skillId` and the caller's `assessorId`. `deleted` is `count > 0`.
    - Place the procedures alphabetically: `deleteSessionSkillCheck` between
      `deleteSession` and `getSession`, and `setSessionSkillCheck` between
      `nextSessionNumber` and `updateSession`. Leave `upsertSessionSkillChecks` alone, since
      task 7 deletes it.
    - No `ctx.logEvent`. Skill check writes aren't logged anywhere today, and `SkillCheck`
      isn't a `LogObjectType` (see Out of scope).
  - **Done when:** tests (per `.claude/rules/testing.md`) cover both procedures.
    `setSessionSkillCheck` creates, then updates the same row (same id, one row); rejects a
    non-assessor (`FORBIDDEN`), an unlinked user (`BAD_REQUEST`), and an assessee or skill
    not on the session (`BAD_REQUEST`); and is refused for a role lacking
    `skillCheck: ["create"]` (`skills-admin`). `deleteSessionSkillCheck` deletes the caller's own check
    (`deleted: true`), leaves another assessor's check on the same assessee/skill alone, and
    returns `deleted: false` when there's nothing to delete. The existing `T.session`
    fixture connects only `assessors`, so the new tests need a session with `assessees` and
    `skills` connected. The delete-isolation test needs a check seeded directly for a second
    assessor. The existing
    `upsertSessionSkillChecks` tests still pass. `npm run check` passes.

- [x] **2. Cache effects + `useSessionCheckRecorder` hook** — feat(skill-track): add session check recorder hooks and cache effects
  - **Files:** `src/client/skill-check-sessions-effects.ts`,
    `src/components/skill-track/use-session-check-recorder.ts` (new)
  - **Do:**
    - Effects for both procedures, following the file's existing shape and
      `src/trpc/mutation-effector.tsx`:
      - Write the own-checks list,
        `trpc.skillChecks.listSkillChecks.queryKey({ organizationId, sessionId, ownChecksOnly: true })`.
        For `setSessionSkillCheck`,
        replace the row with the same `assesseeId`+`skillId`, or append it. For
        `deleteSessionSkillCheck`, filter that pair out.
      - Invalidate every other `listSkillChecks` cache for the org, which covers the
        session's Contents counts, Checks and Review, plus the org-wide dashboard stats and
        `src/client/collections/skill-checks.ts`. Use
        `trpc.skillChecks.listSkillChecks.queryFilter({ organizationId }, { predicate })`.
        The predicate excludes the own-checks key just written:
        `(q) => (q.queryKey[1] as { input?: { ownChecksOnly?: boolean } })?.input?.ownChecksOnly !== true`.
        The query key is `[["skillChecks","listSkillChecks"], { input, type: "query" }]`.
        Also invalidate `trpc.skillChecks.listRecentChecks.queryFilter({ organizationId })`.
        The effector awaits invalidate refetches before the mutation leaves `pending`, so
        a too-broad predicate would keep rows dimmed for a whole refetch.
    - `useSessionCheckRecorder({ sessionId })` wraps both mutations (`useMutation` with
      `meta: { effects }`) and returns:
      - `record({ assesseeId, skillId, result, notes })`. It toasts on error only; success
        is silent.
      - `remove({ assesseeId, skillId })`. On success it toasts "Check removed" with an
        **Undo** action (sonner `action`) that calls `record` with the deleted check's
        result and notes. It toasts on error.
      - Put every toast in the `useMutation(...)` options, never in per-call
        `mutate(vars, { onSuccess })`. TanStack fires per-call callbacks only for the
        observer's latest mutation, so a quick second delete would drop the first Undo. The
        deleted check's values travel from `onMutate`, which reads them from the own-checks
        cache and returns them as context, to `onSuccess`.
    - ``usePendingChecks(sessionId): Map<`${PersonId}::${SkillId}`, SkillCheckResultValue | null>``,
      exported from the same file. It makes one `useMutationState` call with
      `filters: { status: "pending", predicate }`. The predicate matches `mutation.options.mutationKey`
      against `trpc.skillCheckSessions.setSessionSkillCheck.mutationKey()` and
      `…deleteSessionSkillCheck.mutationKey()` (one filter can't take two keys, and the
      partial `[["skillCheckSessions"]]` matches every session mutation), plus
      `variables.skillCheckSessionId`. `select` returns the key and variables. A pending delete maps to
      `null`. Callers call it once, at the page's top level.
  - **Done when:** `npm run check` passes. It has no UI caller yet; task 5 wires it in.
    Unit-test the effects' write updater (replace, append, remove) if
    `skill-check-sessions-effects` has or can have a test file cheaply. Otherwise it's
    covered by the task 5 visual check.

- [ ] **3. `DialogContent` `mobile="sheet"` variant** `visual`
  - **Files:** `src/components/ui/dialog.tsx`, `src/components/ui/README.md`,
    `docs/patterns/mutation-dialog.md`
  - **Do:** Add `mobile?: "fullscreen" | "sheet"` (default `"fullscreen"`) to
    `DialogContent`, exposed as `data-mobile`, the same way `size` uses `data-size`. Below
    `sm`, `"sheet"` makes the content a bottom sheet like `AlertDialogContent`, as tall as
    its content: `top-auto inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl`, a top ring, and
    slide-from-bottom. Scope every sheet class as `max-sm:data-[mobile=sheet]:…`, so none of
    them fight the unprefixed full-screen classes or the `sm:` ones. From `sm` up it's the
    same centred modal as every other `DialogContent`.
    - **Layout:** `DialogContent` is already `flex flex-col overflow-hidden`, and `DialogBody`
      is `min-h-0 flex-1 overflow-y-auto`, so the body scrolls inside the 92dvh cap. Check that
      it does.
    - **Safe areas:** `AlertDialog`'s `--dialog-pad-b` trick doesn't carry over, because
      `DialogContent` has no padding of its own. In a sheet, `DialogHeader` drops its
      `max-sm:pt-[max(1rem,env(safe-area-inset-top))]`, since the header isn't at the top of
      the screen. The last region carries the bottom safe area. `DialogFooter` already does.
      When there's no footer, `DialogBody` needs it, e.g. a
      `group-data-[mobile=sheet]/dialog-content:max-sm:last:pb-[max(1rem,env(safe-area-inset-bottom))]`
      or an equivalent the implementer finds cleaner.
    - Update the `DialogContent` entry in `src/components/ui/README.md` by hand, and the
      sentence in `docs/patterns/mutation-dialog.md` that says a dialog is full screen below
      `sm`, to mention the `mobile="sheet"` exception and when to use it: a short, one-tap
      dialog that isn't a destructive confirm.
  - **Done when:** `npm run check` passes and existing dialogs are unchanged (the default is
    unchanged). Visual check at the checkpoint.

- [ ] **4. `SkillTrack_RecordCheckDialog`** `visual`
  - **Files:** `src/components/skill-track/record-check-dialog.tsx` (new)
  - **Do:** A controlled dialog. It doesn't follow the `?action=` recipes, but read
    `docs/patterns/mutation-dialog.md` for header/body/footer structure and "form state
    lives in the child". Props: `open`, `onOpenChange`,
    `initialDensity: "compact" | "expanded"`, `skillName`, `personName`,
    `current: { result, notes } | null`, `resultOptions` (from
    `getEnabledSkillCheckResultOptions`), `onRecord({ result, notes })` and `onDelete()`. The parent supplies the last two from `useSessionCheckRecorder`,
    so the dialog holds no mutation itself.
    - `DialogContent mobile="sheet"` at the default size. The title is the skill name and
      the description the person name.
    - The body is a child component keyed on the target, so density and staged state reset
      on every open. It holds `density`, `stagedResult` and `stagedNotes`.
    - **The close animation:** the parent keeps `open` separate from `target`. Closing sets
      `open` false and leaves `target` in place, so the title and grid don't go blank during
      Radix's exit animation. The next open replaces `target`. Spell this out in task 5's
      page wiring too.
    - **Compact:** the grouped result grid (Decisions → Compact layout), with no footer.
      Tapping a result calls `onRecord({ result, notes: current?.notes ?? "" })` (unless it's
      the current result) and closes. An **Expand** button (`Maximize2Icon` +
      "Notes & more", ghost, in the header or under the grid) switches to expanded in place.
    - **Expanded:** the same grid, now staging, then a notes `Textarea`, then a footer with
      Delete (`variant="destructive"`, `mr-auto`, only when `current` exists), then Cancel
      (`DialogCloseButton`), then Save. The pattern doc has no Delete-in-footer layout, so
      this sets it. Save is disabled until the
      staged pair differs from `current` and while `stagedResult` is null.
    - Buttons carry the result's icon (`RESULT_ICONS`) and label. The current or staged one
      gets `variant="outline"` + `aria-pressed`.
  - **Done when:** `npm run check` passes. Render it in a test (jsdom, `@testing-library/react`,
    as `assessment-row.test.tsx` does). A compact tap calls `onRecord` and `onOpenChange(false)`.
    Expand then staging then Save calls `onRecord` once with the staged pair. Delete calls
    `onDelete`. Save is disabled while unchanged. Only enabled results render.

- [ ] **5. Dialog-mode rows; entry pages drop the debounced autosave** `visual`
  - **Files:** `src/components/skill-track/check-row.tsx` (new),
    `src/components/skill-track/session-by-person-content.tsx`,
    `src/components/skill-track/session-by-skill-content.tsx`
  - **Do:**
    - The row component,
      `SkillTrack_CheckRow({ title, description?, check: { result, notes } | null, pending, mode, resultOptions, onRecord, onRemove, onOpenDialog(density) })`.
      This task builds
      the `mode="dialog"` layout: title/description as today, then (right-aligned) the notes
      indicator, a result badge (`SkillCheckResultIcon` + the org label, or muted "Not
      recorded"), and a ghost icon button that calls `onOpenDialog("compact")`, using
      `PencilIcon` when a check exists and `PlusIcon` otherwise, with an `aria-label` of
      "Edit check"/"Add check". A `pending` row renders its pending value dimmed with the
      button disabled. Leave `mode="quick"` as a stub for task 6.
    - In both content files, delete the `upsertSessionSkillChecks` `useMutation`, the
      `useDebouncer`, the `changes` state, `handleChange`, `getCurrentValue`'s overlay, the
      `mutation.reset()` in the switch handler, and the navbar `SaveStatusIndicator`. Add
      `useSessionCheckRecorder`, a `target` state and one `SkillTrack_RecordCheckDialog`,
      rendered once at the bottom of the recording column. It uses a `dialogOpen` boolean
      next to `target` (see task 4, "The close animation"). At the top level, call
      `usePendingChecks(sessionId)` once. `renderRow` reads the saved check from
      `skillChecks` and the pending value from that map, and passes both as props. Hard-code
      `mode="dialog"` until task 6. The dialog's `current` is looked up from `skillChecks`
      by `target`. It's null when there's no check.
    - If `target`'s person or skill leaves the session, clear `target` during render, the
      same way `selected` is cleared today.
    - Update the permission comments that cite `upsertSessionSkillChecks` to cite
      `setSessionSkillCheck`/`deleteSessionSkillCheck`.
  - **Done when:** on both pages, as an assigned `skills-assessor`, each of these works and
    survives a reload: record via compact, change the result, add notes via Expand, and
    delete via expanded Delete, then Undo. A second browser tab on the session's Contents
    card shows updated counts after a refetch. No `upsertSessionSkillChecks` or
    `useDebouncer` reference remains in either file. `npm run check` passes.

- [ ] **6. Quick Mode rows + the mode switch** `visual`
  - **Files:** `src/components/skill-track/check-row.tsx`, `src/hooks/use-local-storage-state.ts`
    (new), `src/hooks/use-local-storage-state.test.ts` (new),
    `src/components/skill-track/session-actions-sheet.tsx`, both entry content files
  - **Do:**
    - `useLocalStorageState<T extends string>(key, schema: z.ZodType<T>, defaultValue: T): [T, (v: T) => void]`
      built on `useSyncExternalStore`. Restricting it to strings keeps `getSnapshot` stable:
      it returns the parsed string, never a fresh object. A generic object `T` would loop the
      render. It subscribes to `storage` events plus an in-tab
      event dispatched on set, so two components using one key stay in sync. The server
      snapshot is `defaultValue`. A value that's missing, unparseable or fails the schema
      reads as `defaultValue`. Wrap `localStorage` access in try/catch, since private mode
      can throw.
    - `mode="quick"` in `SkillTrack_CheckRow`, per Decisions → Quick Mode buttons: the notes
      indicator, the Fail/Pass buttons or other-value label, and a `More` ghost icon button
      (`MoreHorizontalIcon`, `aria-label="More options"`) calling
      `onOpenDialog("expanded")`. Keep today's `aria-label`s on Fail/Pass ("Not yet
      competent" / "Competent"). Read the current row for the exact strings.
    - Add `recordingMode` + `onRecordingModeChange` to `SessionEntryView`. The sheet's
      **View** group gains a "Recording" radio pair (Quick / Dialog) styled like the Skill
      Order control beside it.
    - Both pages read the mode from
      `useLocalStorageState("avut:skill-track:recording-mode", z.enum(["quick", "dialog"]), "quick")`
      and pass it to the rows and the sheet.
  - **Done when:** the hook's tests cover the default when unset, a round-trip, falling back
    on a garbage value, and two hook instances staying in sync. Switching mode in the
    sheet changes the rows at once, and the choice survives a reload and applies to the
    other entry page. In Quick Mode, tapping Fail/Pass records the mid tier, tapping the
    active one clears it (with the Undo toast), and tapping it on a check with notes opens
    the dialog expanded instead. `More` opens expanded. A `NotTaught` check shows its label
    and `More`. `npm run check` passes.

  **Visual checkpoint** after this task, covering tasks 3–6: both modes on both entry pages,
  at desktop and phone width (the bottom sheet), with an org that has only Fail/Pass enabled
  and one with the full tier set.

- [ ] **7. Retire `upsertSessionSkillChecks` and `assessment-row`**
  - **Files:** `src/trpc/routers/skill-check-sessions-router.ts`,
    `src/trpc/routers/skill-check-sessions-router.test.ts`,
    `src/components/skill-track/assessment-row.tsx` (delete),
    `src/components/skill-track/assessment-row.test.tsx` (delete),
    `src/components/docs/demo-assessment-row.tsx` (→ `demo-check-row.tsx`),
    `src/components/docs/mdx-components.tsx`, `content/docs/skill-track/sessions.mdx` (the tag only),
    `src/components/skill-track/change-session-assessors.tsx` (comment),
    `docs/modules/skills.md`
  - **Do:** Delete the procedure and its `describe` block. Delete the old row and its test.
    Rework the docs demo to render `SkillTrack_CheckRow` in Quick Mode, holding local state,
    with its `More` opening a local `SkillTrack_RecordCheckDialog`. The row takes plain
    props, so no tRPC is involved. Rename the file `demo-check-row.tsx` and the export
    `DocsCheckRowDemo`, and update both the MDX component map and the
    `<DocsAssessmentRowDemo />` tag in `content/docs/skill-track/sessions.mdx` in this task,
    so the docs page never renders a missing component. In `docs/modules/skills.md`, replace
    the `upsertSessionSkillChecks` prose (the constraint paragraph, the assessor-derivation
    note, the procedure-table row and the "Both grid views…" line) with the two new
    procedures.
  - **Done when:** `grep -rn "upsertSessionSkillChecks\|SkillTrack_AssessmentRow\|assessment-row" src docs content`
    finds nothing outside `docs/plans/` and `docs/reviews/`. `npm run check -- --all` passes.

- [ ] **8. End-user docs**
  - **Files:** `content/docs/skill-track/sessions.mdx`
  - **Do:** Rewrite step 4's recording paragraphs (the cycle buttons, the dropdown and
    "changes autosave a couple of seconds after…") to describe the two modes, the result
    dialog (compact, Expand, notes, Delete + Undo), the retap-to-clear rule and its notes
    exception, and where to switch modes (Actions → View). Keep the demo component.
    - **Screenshots:** don't reference new ids, since `getScreenshot` throws on a missing
      one. List the wanted captures in the report: By Person in Quick Mode, By Person in
      Dialog mode, the compact dialog and the expanded dialog. The main session captures
      them with `avut-doc-screenshots` and adds the `<Screenshot>`s in the same commit that
      adds their ids to `src/lib/screenshots.generated.json`. If an existing capture (e.g.
      the By Person one) now shows the old rows, say so in the report.
  - **Done when:** no text describes cycling or autosave. `/docs/skill-track/sessions` and
    the entry pages' `?help=skill-track/sessions` sheet render, with the demo working.
    `npm run check` passes.

## Out of scope

- **Audit-logging skill check writes.** `SkillCheck` isn't a `LogObjectType`, and no check
  write logs today (the batch upsert, `createSkillCheck`, `updateSkillCheck` or
  `deleteSkillCheck`). Adding it touches the log schema and every check writer, so it
  deserves its own issue: a follow-up to be filed at plan approval.
- **Hardening `deleteSkillCheck`/`updateSkillCheck`.** `deleteSkillCheck` has no ownership
  or session check, and `updateSkillCheck` doesn't recheck session assessor membership.
  Both are pre-existing gaps, and this work stops using them.
- **#319 soft-delete tombstones, and #320's approval lock.** The two new procedures are
  where #320's guard goes when it lands.
- **"Save & Next"** within the dialog.
- **Syncing the mode per user** (server-side preference). It's per browser for now.
