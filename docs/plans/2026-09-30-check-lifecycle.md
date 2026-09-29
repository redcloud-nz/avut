# Plan: skill check lifecycle — approval lock, Pending reopen, Deleted tombstones

**Date:** 2026-09-30
**Issues:** [#320](https://github.com/redcloud-nz/avut/issues/320) (lock + reopen) and the schema
half of [#319](https://github.com/redcloud-nz/avut/issues/319) (`SkillCheck.updatedAt`, `Deleted`
status), as re-scoped in [#336](https://github.com/redcloud-nz/avut/issues/336) Stage 1.
**Branch:** `feat/check-lifecycle`, off `integration`.
**Worktree:** `.claude/worktrees/check-lifecycle` (dev server port in `.dev-port`)
**DB:** adds one migration. Run `npm run db:branch check-lifecycle` before applying it (needs every
connection to `avut` closed), and `npm run db:unbranch` once the branch merges.
**D4H:** nothing here depends on a D4H token.
**Written against:** integration @ 89eb45a2

Today `approveSession` stamps a session's checks `Include`/`Exclude` and moves the session to
`Include`, but nothing stops writes afterwards. This branch makes approval a lock with an explicit
reopen, and turns session check deletes into tombstones that Stage 2's delta poll (#319 client
half) can observe.

- **Lock.** While `SkillCheckSession.status === "Include"`, every procedure that writes a session's
  checks or its configuration refuses with `CONFLICT`.
- **Reopen.** `reopenSession` moves the session back to `Draft` and its `Include` checks to a new
  `Pending` status, so re-approval can start from the previous selection.
- **Tombstones.** Deleting a session check marks it `Deleted` instead of removing the row.
  Re-recording over a tombstone revives the row. `approveSession` purges tombstones.
- **Minimal lock UI.** A Reopen action, an approved review page with no Approve until it's
  reopened, and read-only entry pages. #337 (Stage 2) polishes the review page later.

## Decisions

- **One shared status enum.** `Pending` and `Deleted` are added to `SkillCheckStatus`, which
  `SkillCheckSession.status` also uses. A session never takes either value; its zod schema
  (`src/lib/schemas/skill-check-session.ts`) stays `Draft | Include | Exclude`. `SkillCheck`'s zod
  schema widens to all five.
- **`SkillCheck.updatedAt` is a plain `@updatedAt`.** It moves on every write, approve and reopen
  included. #319 wanted it frozen once a check leaves `Draft`; the Stage 2 poll is better served
  seeing status changes, and `createdAt` (the "checked at" date competency expiry uses) is separate
  either way. The migration backfills existing rows with their `createdAt`.
- **The lock is one service function**, `SkillChecks.assertSessionUnlocked(session)` in
  `src/server/services/skill-checks.ts`, throwing `ConflictError` (mapped to `CONFLICT`). It guards:
  `setSessionSkillCheck`, `deleteSessionSkillCheck`, `updateSessionAssessees`,
  `updateSessionSkills`, `updateSessionAssessors`, `approveSession` (re-approving needs a reopen
  first), and, for session-attached checks, `updateSkillCheck` and `deleteSkillCheck`.
  `updateSession` stays unlocked: name, date and notes may change on an approved session.
  `deleteSession` stays unlocked, but purges the session's tombstones first (see below).
- **Check-then-write, not transactional.** The guard reads the session, then the write runs. A
  write racing an approval by milliseconds can land a `Draft` check in an approved session. It's
  not counted anywhere (only `Include` is authoritative) and shows up for review on the next
  reopen. Accepted.
- **`status` leaves `updateSession`'s input.** `SkillCheckSession.modifiableSchema` drops `status`,
  so a session's status only moves through `approveSession` and `reopenSession`. `createSession`
  always creates `Draft`.
- **`createSkillCheck` becomes standalone-only.** It rejects a non-null `sessionId` at runtime
  (`BAD_REQUEST`); session checks go through `setSessionSkillCheck`. The input stays
  `.nullable()`: the unused `getSkillChecksCollection` (`src/client/collections/skill-checks.ts`)
  passes a nullable string, and it stays as it is. Its only UI caller (`create-check.tsx`) already
  passes `null`. This removes a path that could blindly insert into a locked session or collide
  with a tombstone on the unique key.
- **Any content write moves a session check to `Draft`.** `setSessionSkillCheck`'s update branch and
  `updateSkillCheck` (session-attached) both set `status: "Draft"`. That turns a `Pending` or
  `Exclude` check in a reopened session back into "needs fresh review", and revives a `Deleted` one.
- **Reviving a tombstone resets `createdAt`; editing a live check doesn't.** A re-recorded check is a
  fresh assessment, but editing a live check's notes shouldn't move its "checked at" date. Done in
  one `$transaction`: an `updateMany` that resets `createdAt` only where the row on that key is
  `Deleted`, then the existing upsert.
- **Deletes of session checks tombstone.** `deleteSessionSkillCheck` and `deleteSkillCheck` (for a
  check with a `sessionId`) set `status: "Deleted"`. A standalone check keeps its hard delete.
  `deleteSessionSkillCheck` still returns `deleted: false` when there was nothing live to delete.
- **Undo stays a re-record.** The recorder's Undo still calls `setSessionSkillCheck` with the
  removed result and notes; that now revives the same row. It's offered for any removed check, not
  only `Draft` ones: the lock means an `Include` check can't be deleted, and anything else comes
  back as `Draft`.
- **`approveSession` purges and stamps in one transaction:** delete the session's `Deleted` rows,
  stamp `includedCheckIds` `Include` and the rest `Exclude`, set the session `Include`, log. No
  `Pending` or `Deleted` row survives an approval.
- **`deleteSession` purges tombstones too.** `SkillCheck.sessionId` is `onDelete: SetNull`, so a
  deleted session's tombstones would otherwise become standalone `Deleted` rows that every read
  hides and nothing ever purges. Its transaction `deleteMany`s the session's `Deleted` rows before
  deleting the session.
- **`reopenSession`** (gate `skillCheckSession: ["approve"]`, the same as approving) refuses unless
  the session is `Include`. In one transaction it sets the session `Draft`, moves its `Include`
  checks to `Pending`, and logs a new `Reopen` action. `Exclude` checks stay `Exclude`.
- **Only `Include` is authoritative** (confirmed with the user). `getCompetencyMatrix` already reads
  `status: "Include"` only, so a reopened session's results leave the matrix until it's approved
  again. No change there.
- **`Deleted` is filtered from every other read.** `status: { not: "Deleted" }` on
  `listSkillChecks`, `listRecentChecks`, `getSkillCheck` (→ `NOT_FOUND`), `getSessionMetrics`'
  check count (moved to its own `ctx.prisma.skillCheck.count`, since prisma-mock ignores a `where`
  inside `_count.select`), the three `listSession*` `"all"` scopes, and the check counts shown to people:
  `organizations-router`'s `_count.skillChecks`, `user-router`'s 24-hour activity `groupBy`,
  `Personnel`'s and `SkillPackages`' delete-impact counts. `trash.ts`'s cross-org blocker stays
  unfiltered: it's about rows that exist. `getCompetencyMatrix` needs nothing (it's `Include`-only).
  #319's `listSessionChecks`, the one read that returns tombstones, is Stage 2.
- **`updateSkillCheck` rechecks session membership.** For a session-attached check the caller must
  still be an assigned assessor (#336's pre-existing gap). Its row-ownership check stays.
  `deleteSkillCheck` gets the lock and the tombstone, not an ownership check: `skillCheck:
["delete"]` is an admin grant for removing erroneous checks.
- **The lock UI is minimal** (confirmed with the user): a Reopen item in the session menu with a
  confirm dialog; the review page shows the approved state and no Approve until reopened; the entry
  pages and the Actions sheet's config items are read-only while approved. #337 owns the rest.

## Tasks

- [ ] **1. Schema and migration**
  - **Files:** `prisma/schema.prisma`, `prisma/migrations/<timestamp>_skill_check_lifecycle/migration.sql`,
    `src/lib/schemas/skill-check.ts`, any test fixture that builds a `SkillCheck` record.
  - **Do:**
    - Append `Pending` then `Deleted` to the end of `enum SkillCheckStatus`. Add
      `updatedAt DateTime @updatedAt` to `model SkillCheck`, after `createdAt`.
    - Write the migration SQL without a DB (no `migrate dev`: it needs the branch DB and the user's
      permission; the orchestrator applies it after this task). Generate the base with
      `npx prisma migrate diff --from-schema <copy of HEAD's schema.prisma> --to-schema
prisma/schema.prisma --script`, then hand-edit the column part so it matches what Prisma
      would produce, or `migrate dev` will emit a second migration:
      `ALTER TYPE "SkillCheckStatus" ADD VALUE 'Pending'`, then `'Deleted'` (same order as the
      enum); add `"updatedAt" TIMESTAMP(3)` nullable, `UPDATE … SET "updatedAt" = "createdAt"`,
      then `SET NOT NULL`. Nothing in the migration may use the new enum values (Postgres forbids
      that inside the transaction that adds them). Match the naming of the latest folder in
      `prisma/migrations/`.
    - `npx prisma generate`.
    - `SkillCheck.schema.status` becomes `z.enum(["Draft", "Pending", "Include", "Exclude",
"Deleted"])`, add `updatedAt: z.iso.datetime()`, and `fromRecord` serialises it.
      `SKILL_CHECK_STATUS_LABELS` gains `Pending: "Pending review"` and `Deleted: "Deleted"`.
    - Fix fixtures and tests that construct `SkillCheck` records or outputs to carry `updatedAt`.
  - **Done when:** `npx prisma validate` passes and `npm run check` is green. After the commit, the
    orchestrator runs `npm run db:branch check-lifecycle` and (with permission) `npm run prisma
migrate dev`, and `npm run prisma migrate status` reports the branch DB up to date with no
    drift.

- [ ] **2. The approval lock**
  - **Files:** `src/server/services/skill-checks.ts` (+ `.test.ts`),
    `src/trpc/routers/skill-check-sessions-router.ts` (+ `.test.ts`),
    `src/trpc/routers/skill-checks-router.ts` (+ `.test.ts`), `src/lib/schemas/skill-check-session.ts`,
    `src/trpc/messages.ts` if a message is added, `src/components/skill-track/update-session.tsx`,
    `src/components/skill-track/create-session.tsx`.
  - **Do:**
    - Add `assertSessionUnlocked(session: { id, status })` to the skill-checks service: throws
      `ConflictError("SkillCheckSession(id=…) is approved. Reopen it to make changes.")` when
      `status === "Include"`. Document it as the single lock rule.
    - Call it in `setSessionSkillCheck` and `deleteSessionSkillCheck` (after
      `requireSessionAssessor`), in `updateSessionAssessees`/`updateSessionSkills`/
      `updateSessionAssessors` (on the session `requireSessionById` returns), and in
      `approveSession` (replace its inline lookup with `requireSessionById`).
    - `updateSkillCheck` and `deleteSkillCheck`: load the check's `sessionId`; when it's set, load
      the session and assert unlocked. `updateSkillCheck` also rechecks that the caller is still an
      assigned assessor (reuse `requireSessionAssessor`). A missing check stays `NOT_FOUND`.
    - `createSkillCheck`: reject a non-null `sessionId` with `BAD_REQUEST` and drop the
      session-assessor branch. Keep the input shape (`sessionId` nullable) so the client is
      unchanged, or narrow it to `z.null()` if nothing else breaks — either is fine; say which.
    - Drop `status` from `SkillCheckSession.modifiableSchema`. `updateSession` stops writing it;
      `createSession` writes `status: "Draft"` itself. Update the two dialogs and their tests.
    - Tests: each guarded procedure refuses on an `Include` session and works on `Draft`;
      `createSkillCheck` with a session id is rejected; `updateSkillCheck` by a removed assessor is
      `FORBIDDEN`. Follow `.claude/rules/testing.md`.
  - **Done when:** the tests above pass and `npm run check` is green.

- [ ] **3a. Hide `Deleted` from every read**
  - **Files:** `src/trpc/routers/skill-check-sessions-router.ts` (+ `.test.ts`),
    `src/trpc/routers/skill-checks-router.ts` (+ `.test.ts`), `src/trpc/routers/organizations-router.ts`,
    `src/trpc/routers/user-router.ts`, `src/server/services/personnel.ts`,
    `src/server/services/skill-packages.ts`, plus their tests where they assert the `where`.
  - **Do:**
    - Add `status: { not: "Deleted" }` to every read listed under Decisions → "`Deleted` is
      filtered from every other read". `getSessionMetrics` takes its check count from a separate
      `ctx.prisma.skillCheck.count({ where: { sessionId, status: { not: "Deleted" } } })` instead
      of `_count.skillChecks`. `organizations-router`'s `_count` becomes
      `skillChecks: { where: { status: { not: "Deleted" } } }`.
    - Harmless before any tombstone exists, so this lands first and stays green on its own.
    - Tests: seed a `Deleted` row and show `listSkillChecks`, `listRecentChecks`, `getSkillCheck`,
      `getSessionMetrics` and the `listSession*` `"all"` scopes ignore it. The
      `organizations-router` `_count` filter can't be unit-tested (prisma-mock ignores a `where`
      inside `_count.select`); don't try.
  - **Done when:** those tests pass and `npm run check` is green.

- [ ] **3b. Tombstones, Pending → Draft, and the purges**
  - **Files:** `src/trpc/routers/skill-check-sessions-router.ts` (+ `.test.ts`),
    `src/trpc/routers/skill-checks-router.ts` (+ `.test.ts`).
  - **Do:**
    - `deleteSessionSkillCheck`: `updateMany` on the caller's key where `status: { not: "Deleted" }`,
      setting `status: "Deleted"`; `deleted: count > 0`.
    - `setSessionSkillCheck`: in one `ctx.prisma.$transaction([...])`, first `updateMany` the key
      where `status: "Deleted"` with `createdAt: new Date()`, then the existing upsert with
      `status: "Draft"` added to its `update` branch. Return the upsert's row. Update the JSDoc
      ("a created check takes `Draft`; an update leaves the status alone" is no longer true).
    - `updateSkillCheck`: `NOT_FOUND` for a `Deleted` check; for a session-attached check also set
      `status: "Draft"`.
    - `deleteSkillCheck`: a session-attached check becomes `Deleted` (update); a standalone check is
      still hard-deleted.
    - `approveSession`'s transaction: `deleteMany` the session's `Deleted` rows first, then the two
      stamping `updateMany`s, the session update and the log. Update its JSDoc.
    - `deleteSession`'s transaction: `deleteMany` the session's `Deleted` rows before the session
      delete.
    - Tests: delete leaves a `Deleted` row and a second delete returns `false`; re-record over a
      tombstone revives the same id as `Draft` with a new `createdAt`; re-record over a live check
      keeps `createdAt`; editing a `Pending` check makes it `Draft`; `deleteSkillCheck` tombstones a
      session check and hard-deletes a standalone one; approve and `deleteSession` both purge
      `Deleted` rows. prisma-mock sets `@updatedAt` only on create, so don't assert that
      `updatedAt` moves.
  - **Done when:** those tests pass and `npm run check` is green.

- [ ] **4. `reopenSession` and cache effects**
  - **Files:** `src/trpc/routers/skill-check-sessions-router.ts` (+ `.test.ts`),
    `src/lib/schemas/log-entry.ts`, `src/client/skill-check-sessions-effects.ts` (+ `.test.ts`).
  - **Do:**
    - Add `reopenSession: organizationProcedure({ skillCheckSession: ["approve"] })`, input
      `{ skillCheckSessionId }`, output `{ updated: SkillCheckSession.schema }`, in alphabetical
      position. Refuses with `ConflictError` unless the session is `Include`. One
      `$transaction` per `docs/patterns/transactional-writes.md`: session → `Draft`; `updateMany` its `Include` checks → `Pending`;
      `ctx.logEvent({ action: "Reopen", objectType: "SkillCheckSession", … description })`.
    - Add `"Reopen"` to `logActionValues`, and a line to its doc comment saying what it means.
    - Effects: `reopenSession` writes `getSession` (merge, as `approveSession` does) and
      invalidates the session's `listSkillChecks` (all variants), `listSessions` and
      `getCompetencyMatrix` for the org. Add the `listSessions` and `getCompetencyMatrix`
      invalidations to `approveSession` too — both change with a session's status.
    - Tests: reopen on `Include` sets `Draft`, moves `Include` → `Pending`, leaves `Exclude`, logs
      `Reopen`; reopen on `Draft` is `CONFLICT`; approve after reopen works; effects test covers
      the new keys.
  - **Done when:** those tests pass and `npm run check` is green.

- [ ] **5. Reopen action and the approved review page** — `visual`
  - **Files:** `src/components/skill-track/session-menu.tsx`, a new
    `src/components/skill-track/reopen-session.tsx`, `src/components/skill-track/session-review-content.tsx`,
    `src/components/skill-track/session-content.tsx`, `src/components/skill-track/sessions-list.tsx`,
    `src/components/skill-track/session-checks-content.tsx`, `src/lib/hotkeys.ts`.
  - **Do:**
    - Add `reopen` to `ActionHotkey` in `src/lib/hotkeys.ts` (`MenuActionProps.verb` is typed from
      it). Pick a free key that isn't a common browser shortcut: not Alt+D or Alt+F, and none of
      N, E, Backspace, A, R, O, P, U, M, X, I, V, L, W. Alt+K is a reasonable choice.
    - Session menu gains a `reopen` action, shown only while `session.status === "Include"` and
      enabled by `skillCheckSession: ["approve"]`, opening `SkillsModule_ReopenSession_Dialog` via
      `?action=reopen`. Follow `docs/patterns/mutation-dialog.md` (confirm-dialog shape; model it on
      `delete-session.tsx`) and `docs/patterns/protect-permission-gating.md`. Copy: the session goes
      back to Draft so checks can be changed; its results leave reports until it's approved again.
    - Review page, while approved: the alert says it's approved and to reopen it (from the session
      page) to change the selection; checkboxes are disabled and the Approve button is hidden. The
      initial selection keeps `status !== "Exclude"`, which now includes `Pending` — say so in a
      comment.
    - Show session status through labels (`Include` → "Approved") on the session detail page and
      the sessions list, rather than the raw enum.
    - The Checks page's Status column filter (`session-checks-content.tsx`) gains
      `{ label: "Pending review", value: "Pending" }`.
  - **Done when:** `npm run check` is green, and in the browser: approve a session → review page
    locked, menu shows Reopen → reopen → review page editable with the previous selection
    preselected → re-approve.

- [ ] **6. Read-only entry pages while approved** — `visual`
  - **Files:** `src/components/skill-track/session-by-person-content.tsx`,
    `src/components/skill-track/session-by-skill-content.tsx`, the row/dialog components they render,
    `src/components/skill-track/session-actions-sheet.tsx`, `src/components/skill-track/session-contents.tsx`,
    `src/components/skill-track/use-session-check-recorder.ts`.
  - **Do:**
    - When `session.status === "Include"`, both entry pages show an alert ("This session is
      approved. Reopen it to record or change checks.") and render their rows disabled (no Fail /
      Pass / More, or disabled buttons; the check dialog doesn't open).
    - The Actions sheet's Personnel / Skills / Assessors items and the Contents card's config
      openers are disabled while approved.
    - Recorder hook: offer Undo for any removed check (drop the `Draft`-only condition and update
      the hook's doc comment). On a `CONFLICT` error from either mutation, invalidate the session's
      `getSession` so a page open when someone else approves flips to read-only.
  - **Done when:** `npm run check` is green, and in the browser: on an approved session both entry
    pages are read-only and the sheet's config items are disabled; after reopening they work;
    deleting a check and pressing Undo brings it back.

Visual checkpoint after task 6 (tasks 5 and 6 together).

## Out of scope

- #319's client half: `listSessionChecks({ since })`, the delta poll, "already checked by X", the
  recent-checks dialog (Stage 2).
- #335 conflict resolution and #337's full review page (Stage 2).
- Audit logging of individual skill check writes (#46).
- `updateSessionAssessees` validating that its ids are org personnel (wants its own issue, per
  #336).
- The end-user docs pass on `content/docs/skill-track/sessions.mdx`, which #336 schedules once
  after Stage 2.
- Closing the check-then-write race between the guard and a concurrent approval.
