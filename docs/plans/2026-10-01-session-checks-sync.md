# Session checks sync: cross-assessor live progress on the entry pages

**Date:** 2026-10-01 (first written 2026-09-30; revised at the visual checkpoint, see [Revised at the visual checkpoint](#revised-at-the-visual-checkpoint-2026-10-01))
**Issue:** [#319](https://github.com/redcloud-nz/avut/issues/319), client half, which is Stage 2 of [#336](https://github.com/redcloud-nz/avut/issues/336). Stage 1 (PR #346) already added `SkillCheck.updatedAt`, the `Deleted` tombstone and the `status: { not: "Deleted" }` filters.
**Branch:** `feat/session-checks-sync`
**Worktree:** `.claude/worktrees/session-checks-sync`, with its dev server on 3109 (its `.dev-port`).
**DB:** Tasks 1–7 needed no migration. Task 8 adds one, so before it the orchestrator runs `npm run db:branch session-checks-sync`, which needs the user's 3000 server, Prisma Studio and this worktree's 3109 server stopped. `migrate dev` against the branch DB needs the user's go-ahead. The existing `@@index([sessionId])` is enough at session sizes, which run to hundreds or low thousands of rows.
**D4H:** nothing here depends on a D4H token.
**Written against:** integration @ c59cc113

## Goal

An assessor on `by-person` or `by-skill` sees, within about 10 seconds:

- the other assessors' checks on the same assessee and skill, as a marker on the row;
- their own checks recorded from another device;
- the session being approved or reopened by someone else.

A **Recent checks** dialog in the Actions sheet lists the session's checks, newest first.

## Decisions

### Revised at the visual checkpoint (2026-10-01)

Tasks 1–7 were built as first planned, with `updatedAt` as the sync cursor. At the visual checkpoint the user found that approval re-stamps every check's `updatedAt`, so the Recent checks order means nothing after an approve or reopen. Using `createdAt` instead was considered and rejected: on every other model it means "when the row was first created", and moving it on each write would be misleading. The decisions below replace the `updatedAt` cursor. Where the sections further down say `updatedAt`, read `recordedAt`.

- **`SkillCheck` drops `createdAt` and `updatedAt`, and gains two purpose-named fields:**

  | Field        | Meaning                                                                                               | Written by                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Not touched by                                     |
  | ------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
  | `recordedAt` | When an assessor last recorded or removed the check. It's the sync cursor and the Recent checks time. | Every assessor write, set explicitly: `createSkillCheck`, both write paths of `updateSkillCheck` (standalone and session), `setSessionSkillCheck` (both upsert branches), and the tombstone writes in `deleteSessionSkillCheck` and `deleteSkillCheck`. `DateTime @default(now())`, **not** `@updatedAt`.                                                                                                                                                        | approve, reopen, exclusions, the Rubbish-bin purge |
  | `checkedAt`  | When the assessment happened. Competency expiry, the competency matrix and the reports use it.        | A session check: the session's date (`new Date(session.date)` from the `SkillCheckSession` DTO, which is always set), set by `setSessionSkillCheck`, and re-stamped on the session's checks when `updateSession` changes the date (see Task 9). A standalone check: now, at `createSkillCheck`, which only creates standalone checks (it refuses a `sessionId`). `updateSkillCheck` leaves it alone. `DateTime`, with no default, so every writer has to set it. | everything else                                    |

- **`updatedAt` on `SkillCheckSession` stays.** It's the session row's own, and the approval guard still relies on it.
- **An approved session's date is locked.** Its name and notes stay editable. Approved competency dates can then only move through a reopen, which goes back through review. When an unlocked session's date changes, `updateSession` re-stamps its checks' `checkedAt` (Task 9).
- **The approval guard moves to `recordedAt`.**
  - `assertApprovalMatchesSavedState`'s `checksAsOf`, and `approveSession`'s `unchangedSince` and tombstone-purge conditions, compare `recordedAt` instead of the checks' `updatedAt`.
  - The guard exists to catch a check recorded, re-recorded or deleted since the review loaded, which is exactly what `recordedAt` tracks.
  - Exclusion and config edits don't touch `recordedAt`. The guard still catches them through the session row's `updatedAt`, which `lockUnapprovedSession`, `updateCheckExclusions` and the config writes bump.
- **Standalone checks can't be edited in the UI.** `updateSkillCheck` is only reached through the unused `getSkillChecksCollection`. That's why `updateSkillCheck` moves `recordedAt` but leaves `checkedAt` alone, the conservative choice. A follow-up issue adds a `date` (`checkedAt`) field to the standalone create and update forms.
- **`listRecentChecks` filters and sorts on `checkedAt`.** It's about assessments that happened, not data entry.
- **`getCompetencyMatrix` orders by `checkedAt`.** It's still a single-table query and needs no join to the session.
- **The user router's 24-hour activity counts** (`user-router.ts`, a `skillCheck.groupBy` on `createdAt`) move to `recordedAt`: they count data entry. They now also count re-records.
- **The delta carries assessor writes only.** Approve, reopen and exclusions no longer move the cursor field, so a check's `Include`/`Exclude`/`Pending` status never reaches `listSessionChecks`. And a poll that was in flight can leave a pre-approval status in the session cache or the own list. Nothing renders a check's status from either cache except `Deleted`, and consumers mustn't start to. Session-level changes reach clients through `sessionStatus`. `listSessionChecks`'s JSDoc and the "Why not the newest row's stamp" paragraph below are updated to match: an approval no longer re-stamps every check.
- **Display:**
  - The review page's checks dialog and the conflict resolver show `recordedAt`, as the time the check was recorded.
  - The checks list shows `checkedAt`.
  - The Recent checks dialog sorts and shows `recordedAt`.
- **Migration backfill:**
  - `recordedAt = "updatedAt"` for `Draft` and `Deleted` rows, since approve and reopen never re-stamp those. For other rows it's `createdAt`, because the old `updatedAt` there was re-stamped by approval. That's slightly early for an approved check that was edited before approval, an accepted inaccuracy in old data. Strictly, `Draft` also covers an exclusion undone on the review page, which bumped `updatedAt` too. That's close enough.
  - `checkedAt = session.startsAt ?? createdAt`. This deliberately moves existing session checks' competency dates to their session's date.
  - The columns are added nullable, backfilled, then set `NOT NULL`, the same shape as Stage 1's migration.
- **Renames don't reach the delta** (as before), and neither does the purge's `assessorLabel` write any more. Both only show on reload.
- **The entry pages, once a session is approved:**
  - `by-person` and `by-skill` replace their whole content with a centred message ("This session has been approved.") and a link back to the session page. This replaces today's "Approved" alert above the read-only rows. A page already open gets there on the next poll through `sessionStatus` and, after a reopen, comes back the same way.
  - The By Person and By Skill links on the session page (`session-content.tsx`) and in the Actions sheet's Record section are disabled while the session is approved.
- **Skill description:** the Actions sheet's "Show: Skill Description" option and both pages' `showSkillDescription` state go. The row has no room for a description beside the marker. Instead, the record-check dialog always shows the skill's description under its title.

### Server

- **`listSessionChecks({ skillCheckSessionId, since? })`** is a new procedure on `skillCheckSessionsRouter`.
  - It's gated on `organizationProcedure({ skillCheckSession: ["view"], skillCheck: ["view"] })`. That's the union of `getSession`'s gate and `listSkillChecks`'s gate. Every role with the first also holds the second, so anyone who can see the session can call it.
  - It throws `NOT_FOUND` for a session outside the org, via `SkillChecks.requireSessionById`.
  - It is the **only** read that returns `Deleted` rows.
- **Output:** `{ checks: SessionCheck[], cursor: string, sessionStatus }`.
  - `SessionCheck` is `SkillCheck.schema` extended with `assesseeName`, `skillName` and `assessorName`. `assessorName` comes from `assessorDisplayName`, which falls back for a purged assessor.
  - The names come from `include`d relations, so each row describes itself. The marker and the dialog need no extra lookups, including for people and skills no longer assigned to the session.
  - `sessionStatus` is the session's `status`, so a poll also notices an approval or a reopen made elsewhere.
- **The cursor is a server-clock watermark, lagged by a lookback.**
  - The procedure takes `readStart = new Date()` before its `findMany`.
  - With `since`, it queries `updatedAt > since`, with no subtraction. Without `since`, it returns every row.
  - It returns `cursor = max(since, readStart − SESSION_CHECKS_LOOKBACK_MS)`, where the lookback is 10 000, or `readStart − lookback` with no `since`. The cursor never moves backwards.
  - **Why the lag:** `@updatedAt` is stamped by the app when it builds the query, not when the write commits. The plan review confirmed this against Prisma 7.8, including for `updateMany`. So a write stamped at t1 can commit after a poll has already read a row stamped at t2 > t1, and a cursor set to the newest row seen would skip that write for good. Clock differences between serverless instances cause the same problem. A row stamped at or before `readStart − lookback` has committed by `readStart`, assuming commit delay plus clock skew stay under 10 s.
  - **Why not the newest row's stamp:** that cursor never moves once writes stop, so every later poll would re-send the last burst of writes. `approveSession` and `reopenSession` stamp every check with one timestamp, so an approved session would re-send all its rows every 10 s from every open tab. A watermark moves with the clock, and each row is re-sent about once more after the poll that first returned it. The client merge therefore has to be idempotent, and it is (next section).
- **`deleteSessionSkillCheck` also returns the row it tombstoned:** `{ deleted: boolean, check: SkillCheck | null }`.
  - The row is read with `findUnique` on the unique key after the transaction, only when `deleted` is true.
  - The client uses it to put the tombstone in the session cache with the server's `updatedAt` (see the next section).
  - The caller's other device can re-record the check between the transaction and the read. So `check` is usually `Deleted` but not always; the JSDoc says so, and the newer-wins merge handles both.
  - `deleted` keeps its meaning, so the Undo toast is unchanged.

### Client cache

- **Two caches, one merge rule.**
  - The **session cache** is the `listSessionChecks({ organizationId, skillCheckSessionId })` query key, with no `since`. It holds every assessor's rows, tombstones included, as `{ checks, cursor, sessionStatus }`.
  - #322's **own-checks list** (`listSkillChecks({ …, ownChecksOnly: true })`) is unchanged. The rows, the record dialog and Undo all keep reading it.
- **Merge rule, "newer-or-equal `updatedAt` wins, per id":**
  - An incoming row replaces the cached row with the same `id` only if its `updatedAt` is the same or later. A row with an unknown `id` is added.
  - An equal stamp is the same version of the row. So a poll's copy fills in the names on a row a local write added without them (see below).
  - Tombstones **stay** in the session cache as `Deleted` rows. That's how the cache remembers a deletion, so a stale live row from the overlap can't bring the check back. Consumers ignore `Deleted` rows.
  - A tombstone that approval purged (a hard delete) stays in the cache as `Deleted`, which does no harm.
- **The delta `queryFn`** replaces the tRPC `queryOptions`' own and keeps its key:
  1. It reads `since` from the cached data's `cursor` before fetching.
  2. It fetches with `trpcClient.skillCheckSessions.listSessionChecks.query({ …, since }, { signal })`.
  3. After the response arrives, it re-reads the cache (via the QueryFunctionContext's `client`) and merges into that, not into the snapshot from before the fetch. A mutation effect that wrote the cache while the request was in flight is therefore kept. There is no `await` between the re-read and the `return`, and TanStack commits the result in microtasks, so no effect can slip in between.
  4. It keeps the later of the old and the new `cursor`.

  A cancelled fetch may still have applied its own-list patch. The newer-only rules make that harmless.

- **Patching the own-checks list:** only the rows the session merge actually applied, and only those whose `assessorId` is the caller's person (`getPersonSelf`), go to the own-checks list.
  - A live row replaces or adds, but only if its `updatedAt` is the same as or later than the own row's.
  - A `Deleted` row removes the own row, but only if the tombstone's `updatedAt` is at least the own row's.
  - This keeps a second device in sync without a poll response that was in flight undoing a local write.
- **The write effects always feed the session cache too.**
  - `setSessionSkillCheck`'s effect merges the returned check into a cached session list, and `deleteSessionSkillCheck`'s merges the returned row. Both use the same merge rule, whether or not the id is already cached.
  - Names come from the cached row with the same id, or are `""`. The next poll's copy has the same stamp and fills them in. An effect only sees `old` for its own key (`write()` in `src/trpc/mutation-effector.tsx`), so it can't look names up elsewhere. Consumers skip a row whose names are still `""`.
  - With every local write in the session cache, a stale poll row that raced it is rejected by the session merge, so it never reaches the own list. That includes a check created and then deleted while a poll was in flight.
  - The approve and reopen effects also set the session cache's `sessionStatus`.
- **Polling:**
  - `refetchInterval: 10_000`. TanStack's default `refetchIntervalInBackground: false` stops it while the tab is hidden, and `refetchOnWindowFocus` (also the default) catches up as soon as the user comes back.
  - "Paused when the tab loses focus" is read as "while hidden". A second window side by side keeps updating, which suits a tablet in split screen.
  - The polling hook is enabled only while the recording rows show: a linked person who is an assigned assessor and can record.
  - It keeps polling on an approved session, since `sessionStatus` is how a reopen gets noticed.
- **Session status:** when a response's `sessionStatus` differs from the cached `getSession`'s `status`, the hook invalidates `getSession` and the session's `listSkillChecks` queries, the same set `useRefetchSessionOnConflict` invalidates.
  - The check runs in a `useEffect` keyed on `data.sessionStatus`, never during render.
  - So an approval by the coordinator turns the page read-only without the user first having to hit a `CONFLICT`.
- **The initial load is not a suspense query.** This is a deliberate exception to `docs/patterns/detail-page-data-fetching.md`, and a code comment says why: the markers are secondary, and the page shouldn't wait for them. The page renders as it does today, and the markers appear once the first `listSessionChecks` lands.
- **One options builder for every observer.** TanStack uses the `queryFn` of whichever observer set its options last. So the polling hook and the read-only observers (marker, dialog) build their options with the same `sessionChecksQueryOptions` and the same inputs.

### UI

- **The row marker reads "Also checked by Jane (Competent), Bob (Not Yet Competent)"** (decided at L1: name and result).
  - It lists the other assessors' live checks on the same assessee and skill.
  - It goes under the row title in `text-xs text-muted-foreground`, and uses the org's result labels (`getSkillCheckResultLabel`).
  - The caller's own check never appears in it.
  - It also shows on approved sessions.
- **The Recent checks dialog shows the latest state per check,** not an event history (decided at L1).
  - It lists every row in the session cache that has its names, sorted by `updatedAt`, newest first. The cache can't tell a tombstone purged by approval from any other, so those show until the page reloads.
  - Each entry shows the assessee and skill; the result and "by <assessor>"; and the time, with `formatRelativeDateTime`. A tombstone shows as "Removed by <assessor>", muted.
  - It shows the 100 most recent, with a footer "Showing the 100 most recent of N" when there are more.
  - It opens from a new **Activity** section in the Actions sheet, as a "Recent checks" item. The item is enabled for anyone who can open the sheet, approved or not.
  - It follows `docs/patterns/mutation-dialog.md` ("The `action` param", "Menu-triggered dialogs and focus") and the sheet's existing hand-off: the sheet closes, and the dialog is hosted as a sibling of `Sheet`. It's driven by `?action=recent-checks`, read raw as in `useSessionConfigAction`, with push on open and replace on close.
  - While open, it observes the session query with its own `refetchInterval: 10_000`. It stays live for someone who can open the page but isn't recording, whose page has the polling hook off. For a recording assessor, both observers share one query.

## Tasks

- [x] **1. `listSessionChecks` procedure** — feat(skill-track): add listSessionChecks for live session sync
  - **Files:** `src/lib/schemas/skill-check.ts`, `src/trpc/routers/skill-check-sessions-router.ts`, `src/trpc/routers/skill-check-sessions-router.test.ts`.
  - **Do:**
    - Add the `SessionCheck` schema (`SkillCheck.schema.extend({ assesseeName, skillName, assessorName })`) and its type, and export `SESSION_CHECKS_LOOKBACK_MS = 10_000`.
    - Add `listSessionChecks` as described under Decisions → Server:
      - `SkillChecks.requireSessionById` for the NOT_FOUND;
      - `readStart` taken before `skillCheck.findMany`;
      - the query filters on `organizationId` and `sessionId`, plus `updatedAt: { gt: since }` when `since` is given;
      - `include` the assessee's and skill's `name`, and the `assessor`'s `name`;
      - the cursor is computed from `readStart`.
    - `since` is `z.iso.datetime().optional()`.
    - The JSDoc explains the watermark.
    - Follow `src/trpc/CLAUDE.md`. It's a read, so there's no `logEvent`.
  - **Done when:** the router tests (prisma-mock, per `.claude/rules/testing.md`, with fake timers for `readStart`) cover:
    - it returns `Deleted` rows;
    - the `updatedAt > since` filter;
    - the cursor is `readStart − lookback` with no `since`, `max(since, readStart − lookback)` otherwise, and never earlier than `since`;
    - `sessionStatus`;
    - `assessorName` falls back to `assessorLabel`;
    - NOT_FOUND for another org's session;
    - the permission gate.

    `npm run check` passes.

- [x] **2. `deleteSessionSkillCheck` returns the row it tombstoned** — feat(skill-track): return the tombstoned row from deleteSessionSkillCheck
  - **Files:** `src/trpc/routers/skill-check-sessions-router.ts`, its test, and `src/components/skill-track/use-session-check-recorder.ts` only if its types need it.
  - **Do:**
    - Extend the output to `{ deleted, check: SkillCheck | null }`.
    - When `count > 0`, `findUnique` the row on `assesseeId_assessorId_sessionId_skillId` after the transaction and return `SkillCheck.fromRecord`. Otherwise return `check: null`.
    - Update the JSDoc `@returns`, including the case where the row was re-recorded in between.
  - **Done when:** the tests assert the row is returned after a delete and `check: null` when there was nothing to delete, and `npm run check` passes.

- [x] **3. Merge helpers** — feat(skill-track): add session checks merge helpers; fix(skill-track): pass identical re-sends to the own-checks patch
  - **Files:** `src/lib/session-checks-sync.ts` and `src/lib/session-checks-sync.test.ts` (new), and `src/components/skill-track/use-session-check-recorder.ts`.
  - **Do:**
    - Move `SessionCheckKey` and `sessionCheckKey` into the new lib file, since `src/lib` can't import from components (lint). Re-export them from the hook module so the existing imports keep working.
    - Write pure functions, with no React or tRPC:
      - `mergeSessionChecks(cached: SessionCheck[], incoming: SessionCheck[]): { checks: SessionCheck[]; applied: SessionCheck[] }`. Newer-or-equal `updatedAt` wins per id, and unknown ids are added. It returns the same `cached` array when nothing applies, so subscribers don't re-render.
      - `patchOwnChecks(own: SkillCheck[] | undefined, applied: SessionCheck[], selfPersonId: PersonId): SkillCheck[] | undefined`. Only the caller's rows count. A live row replaces or adds when its `updatedAt` is at least the own row's. A `Deleted` row removes the own row when its `updatedAt` is at least the own row's. The result is stripped to the `SkillCheck` shape, it returns the same array when nothing changes, and it leaves `undefined` alone.
      - `maxCursor(a, b)`.
      - `otherAssessorChecks(checks, selfPersonId): Map<SessionCheckKey, { assessorName; result }[]>`. Live rows only, not the caller's and not ones without names, sorted by `assessorName`.
  - **Done when:** the unit tests cover:
    - an older row is ignored, and a newer or equal one is applied (equal fills in names);
    - a tombstone blocks a stale live row;
    - the own patch ignores other assessors;
    - the own patch's newer-only rules for both a live row and a tombstone;
    - the same-reference returns;
    - `otherAssessorChecks` drops tombstones, the caller's rows and rows without names.

    `npm run check` passes.

- [x] **4. Write effects feed the session cache** — feat(skill-track): feed check writes into the session checks cache; fix(skill-track): keep a re-recorded check in the own list after delete
  - **Files:** `src/client/skill-check-sessions-effects.ts`, `src/client/skill-check-sessions-effects.test.ts`.
  - **Do:**
    - Add a `write` of the session cache key to `setSessionSkillCheck` and `deleteSessionSkillCheck`. It merges the returned row through `mergeSessionChecks`, whether or not the id is already cached. Names come from the cached row with the same id, else `""`. The delete effect skips when `check` is null.
    - The approve and reopen effects also set the session cache's `sessionStatus`.
    - A `write` updater only sees `old` for its own key: see the `write()` docstring in `src/trpc/mutation-effector.tsx` and the existing effects in the same file.
    - The test file's `applyWrite` helper asserts exactly one `write`, so adapt it now that these effects write two keys.
  - **Done when:** the effect tests cover:
    - set and delete merge into a cached session list, adding an unknown id with empty names;
    - an uncached list stays uncached;
    - other assessors' rows are untouched;
    - approve and reopen set `sessionStatus`.

    `npm run check` passes.

- [x] **5. Sync hook and page wiring** — feat(skill-track): poll session checks on the entry pages; fix(skill-track): make the session checks query always stale
  - **Files:** `src/components/skill-track/use-session-checks-sync.ts` (new), a test beside it, `src/components/skill-track/use-refetch-session-on-conflict.ts`, and the two entry-page content files.
  - **Do:**
    - Export `sessionChecksQueryOptions({ organizationId, sessionId, selfPersonId })`. It spreads `trpc.skillCheckSessions.listSessionChecks.queryOptions({ organizationId, skillCheckSessionId })` and replaces `queryFn` with the delta `queryFn` from Decisions → Client cache: read the cursor, fetch through `trpcClient` with the `signal`, re-read through the context's `client` after the response, merge, patch the own-checks list with `setQueryData`, and keep the later cursor.
    - Export `useSessionChecksSync({ sessionId, selfPersonId, enabled })`. It calls `useQuery` with those options and `refetchInterval: 10_000`, runs the `sessionStatus` comparison in a `useEffect`, and returns the query's `data`.
    - On the **first load** (the re-read after the response finds no cached data), skip the own-list patch entirely. The own list has its own query. And an own-list delete made while that first load was in flight left no tombstone in the session cache (an uncached list stays uncached), so patching would bring the stale live row back. From the second response on, the effects have written every local write into the session cache.
    - Take the response's `sessionStatus` as it comes. A poll in flight across a local approve or reopen can briefly put back the old status. The `useEffect` then sees a mismatch with `getSession` and does one extra invalidation, which refetches the truth, and that's accepted.
    - The comment on the `useQuery` says why it isn't a suspense query.
    - Factor the invalidation out of `useRefetchSessionOnConflict` into a shared helper that both use.
    - Export `useSessionChecks({ sessionId, selfPersonId, enabled, refetchInterval? })` for other observers. It uses the same options builder.
    - Both entry pages call `useSessionChecksSync` with `selfPersonId: personSelf?.id` and `enabled: !!personSelf && isAssignedAssessor && canRecordChecks`. Nothing renders from it yet.
  - **Done when:** a `queryFn` test with a mocked `trpcClient` and a real `QueryClient` shows:
    - the first call has no `since` and a later call passes the cursor;
    - a cache write made while the fetch was in flight survives the merge;
    - the own list is patched;
    - the create → poll starts → delete → poll returns the stale live row sequence leaves the check gone from both caches;
    - a delete made during the first load doesn't come back in the own list.

    `npm run check` passes.

- [x] **6. "Also checked by" marker** `visual` — feat(skill-track): show other assessors' checks on the recording rows; refactor(skill-track): share the other-assessor markers memo as a hook
  - **Files:** `src/components/skill-track/check-row.tsx`, `session-by-person-content.tsx`, `session-by-skill-content.tsx`.
  - **Do:**
    - Add an optional `otherChecks?: { assessorName: string; result: SkillCheckResultValue }[]` prop to `SkillTrack_CheckRow`. When it's non-empty, render "Also checked by Jane (Competent), Bob (…)" under the title in `text-xs text-muted-foreground`, labelled with `resultLabel`. The layout otherwise stays as it is: the title column grows and the buttons stay right-aligned.
    - Each page computes `otherAssessorChecks(data?.checks ?? [], personSelf.id)` once with `useMemo`, from `useSessionChecksSync`'s returned `data` and only when `personSelf` is set. It passes each row its entry.
  - **Done when:** with two assessors recording on one session, each sees the other's result on the matching row within about 10 s, and a removal clears it. `npm run check` passes.

- [x] **7. Recent checks dialog** `visual` — feat(skill-track): add a Recent checks dialog to the session actions sheet; fix(skill-track): load the Recent checks dialog through suspense. (As built, the dialog reads through `useSuspenseQuery` with `sessionChecksQueryOptions`, and `useSessionChecks` folded into `useSessionChecksSync`.)
  - **Files:** `src/components/skill-track/session-recent-checks-dialog.tsx` (new) and `src/components/skill-track/session-actions-sheet.tsx`.
  - **Do:**
    - Build `SkillTrack_SessionRecentChecksDialog` as described under Decisions → UI: a scrolling list in a `Dialog`, using the `size` prop (#334) if the default width is cramped.
    - Add a `useRecentChecksAction()` hook for `?action=recent-checks`, modelled on `useSessionConfigAction`.
    - The dialog observes through `useSessionChecks` with `refetchInterval: 10_000`, enabled while open. It gets `selfPersonId` from `getPersonSelf`.
    - In the sheet, add an "Activity" section between Record and Skill Order, with a "Recent checks" item (`HistoryIcon`). It hands over to the dialog as `handleConfigure` does, and the dialog is hosted beside `SkillTrack_SessionConfigDialogs` with `returnFocusRef={triggerRef}`.
    - Results use the org's labels. A tombstone reads "Removed by X", muted.
  - **Done when:** the dialog opens from the sheet on both pages, lists newest first, shows removed checks, updates while open (including for a viewer who isn't recording), and Back closes it. `npm run check` passes.

### Added at the visual checkpoint (2026-10-01)

**Before Task 8 (orchestrator):** stop 3109, ask the user to stop 3000 and Prisma Studio, and run `npm run db:branch session-checks-sync`. After Task 8's schema and migration are written, apply them with `npm run prisma migrate dev` (with the user's go-ahead) and confirm it generates no further migration.

- [x] **8. Replace `SkillCheck.createdAt`/`updatedAt` with `checkedAt`/`recordedAt`** — feat(skill-track): replace SkillCheck createdAt/updatedAt with checkedAt/recordedAt; fix(skill-track): break checkedAt ties in the competency matrix deterministically
  - **Why one task:** the rename touches the Prisma model and the shared `SkillCheck` Zod schema, so nothing typechecks until every reader and writer has moved. It's mechanical apart from the writers and the guard.
  - **Files:**
    - `prisma/schema.prisma` and a new `prisma/migrations/<timestamp>_skill_check_checked_recorded_at/migration.sql`;
    - `src/lib/schemas/skill-check.ts`;
    - `src/trpc/routers/skill-checks-router.ts`, `src/trpc/routers/skill-check-sessions-router.ts`, `src/server/services/skill-checks.ts`;
    - `src/lib/session-checks-sync.ts`, `src/components/skill-track/use-session-checks-sync.ts`, `src/client/skill-check-sessions-effects.ts`;
    - `src/components/skill-track/session-recent-checks-dialog.tsx`, `review-checks-dialog.tsx`, `resolve-conflict.tsx`, and `src/app/(wrapper)/(authenticated)/orgs/[slug]/skill-track/checks/checks-list.tsx`;
    - `src/trpc/routers/user-router.ts` (the 24-hour activity `groupBy`);
    - `prisma/seed-demo.ts`: its `createMany` sets both `checkedAt: when` and `recordedAt: when`, not just the default;
    - every affected test, including those that create skill checks and will stop typechecking without `checkedAt`: `src/server/services/personnel.test.ts`, `skill-packages.test.ts`, `trash.test.ts`, `src/trpc/routers/skill-checks-router.test.ts` and `skill-check-sessions-router.test.ts`.

    `git grep -nE '\b(createdAt|updatedAt)\b'` over `src` and `prisma/seed-demo.ts` finds the rest. Be careful to change only `SkillCheck`'s fields: `SkillCheckSession` and the other models keep theirs.

  - **Do:**
    - **Schema:**
      - Replace the two fields with `checkedAt DateTime` and `recordedAt DateTime @default(now())`. Each gets a doc comment saying what it means and who writes it, from Decisions → Revised.
      - Write `migration.sql` by hand, following `prisma/migrations/20260930000000_skill_check_lifecycle/migration.sql`:
        - add both columns as nullable `TIMESTAMP(3)`;
        - backfill `"recordedAt"` with `CASE WHEN status IN ('Draft', 'Deleted') THEN "updatedAt" ELSE "createdAt" END`, and `"checkedAt"` with `COALESCE((SELECT s."startsAt" FROM "skill_check_sessions" s WHERE s.id = c."sessionId"), c."createdAt")`;
        - set both `NOT NULL`, with `recordedAt`'s default `CURRENT_TIMESTAMP`;
        - drop `"createdAt"` and `"updatedAt"`.
      - Run `npx prisma generate`. **Don't** run `migrate dev`; the orchestrator applies it.
    - **Zod:** `SkillCheck.schema` and `fromRecord` swap to `checkedAt`/`recordedAt` (ISO strings).
    - **Writers:** follow the Decisions table.
      - `setSessionSkillCheck` sets `recordedAt: now` and `checkedAt: new Date(session.date)` in both upsert branches. `session` is the DTO `requireSessionAssessor` already returns. Its tombstone-only `createdAt` `updateMany` goes, since the upsert now covers it, so the transaction's destructuring becomes `[, check]`.
      - The tombstone writes in `deleteSessionSkillCheck` and `deleteSkillCheck` set `recordedAt: now`.
      - `createSkillCheck`, which only creates standalone checks, sets both to now.
      - `updateSkillCheck` sets `recordedAt: now` only, on both its write paths: the standalone `update` and the session-branch `update` inside its `$transaction`.
      - `approveSession`, `reopenSession`, `updateCheckExclusions` and `trash.ts`'s purge set neither.
    - **Approval guard:** `assertApprovalMatchesSavedState` (`checksAsOf` reads `recordedAt`) and `approveSession` (`unchangedSince` and the tombstone purge filter on `recordedAt`). Update the doc comments that describe them.
    - **Readers:**
      - `getCompetencyMatrix` selects and orders by `checkedAt`, and computes `checkedAt` and `expiresAt` from it.
      - `listRecentChecks` filters and orders by `checkedAt`.
      - `listSessionChecks` filters on `recordedAt > since`.
      - The UI shows the field named in Decisions → Display.
      - `user-router.ts`'s 24-hour activity `groupBy` filters on `recordedAt`.
    - **Sync code:** `mergeSessionChecks`, `patchOwnChecks`, the effects and the dialog compare and sort by `recordedAt`. Rename `updatedAt` to `recordedAt` in their doc comments. Update `listSessionChecks`'s JSDoc as in Decisions → Revised ("The delta carries assessor writes only").
    - **Order of work:** schema and migration, `prisma generate`, the Zod schema, the server writers, the guard, the server readers, the sync code, the UI, then the tests.
  - **Done when:**
    - `npm run check -- --all` passes;
    - the existing approval-guard tests pass against `recordedAt`;
    - new router tests assert:
      - `setSessionSkillCheck` writes `checkedAt` as the session's `startsAt` and `recordedAt` as now;
      - a tombstone write moves `recordedAt` only;
      - `approveSession`/`reopenSession` move neither field;
      - `createSkillCheck` sets both to now;
      - both `updateSkillCheck` paths move `recordedAt` and not `checkedAt`;
      - `getCompetencyMatrix`'s `checkedAt` is the session date for a session check.
    - The migration applies cleanly to the branch DB (orchestrator).

- [ ] **9. Re-stamp `checkedAt` when a session's date changes**
  - **Files:** `src/trpc/routers/skill-check-sessions-router.ts` and its test; `src/server/services/skill-checks.ts` (`assertSessionUnlocked`'s doc); `src/client/skill-check-sessions-effects.ts` and its test; `src/components/skill-track/update-session.tsx`.
  - **Decided (2026-10-01): an approved session's date is locked.** `updateSession` stays outside the approval lock for name and notes. But a date change on an approved session throws the lock's `CONFLICT` (`SkillChecks.sessionLockedError`), so approved competency dates only move through a reopen, which goes back through review.
  - **Do:**
    - In `updateSession`, refuse a date change while `existing.status === "Include"`, with `sessionLockedError`. Update its JSDoc ("Not subject to the approval lock" becomes "the name and notes are; the date is locked while approved") and `assertSessionUnlocked`'s doc to match.
    - `update-session.tsx` disables the date field while the session is approved, with a short description saying why ("Reopen the session to change its date.").
    - **Race:** the `updateMany` below only runs on an unapproved session, but an approval can land between the pre-check and the write. Open the `$transaction` with `SkillChecks.lockUnapprovedSession` when the date changes, mapped with `rethrowSessionLocked`, as the check writes do.\*\*
    - In `updateSession`, when the date changes (`new Date(existing.date).getTime() !== new Date(update.date).getTime()`; `existing` is the DTO, with `date` and no `startsAt`), add a `skillCheck.updateMany({ where: { organizationId, sessionId }, data: { checkedAt: new Date(update.date) } })` to the existing `$transaction`. That's every row in the session, tombstones included, so a revived tombstone doesn't carry the old date.
    - It doesn't touch `recordedAt`. It needs no separate log entry: the session's own Update entry records the date change.
    - The `updateSession` effect also invalidates `getCompetencyMatrix`, `listRecentChecks` and the session's `listSkillChecks` when the date changed, since `checkedAt` has moved.
  - **Done when:** tests show:
    - a date edit moves every check's `checkedAt` and no `recordedAt`;
    - a name-only edit leaves `checkedAt` alone;
    - a date edit on an approved session is refused with `CONFLICT`, while a name or notes edit on it still succeeds.

    `npm run check` passes.

- [ ] **10. Skill description moves into the record dialog** `visual`
  - **Files:** `src/components/skill-track/session-actions-sheet.tsx`, `record-check-dialog.tsx`, `session-by-person-content.tsx`, `session-by-skill-content.tsx`, and `check-row.tsx` (plus `check-row.test.tsx`).
  - **Do:**
    - Remove the sheet's "Show" section and `SessionEntryView`'s `showSkillDescription`/`onShowSkillDescriptionChange`, and both pages' state for them.
    - `SkillTrack_CheckRow` loses its `description` prop. The title column's `description || alsoCheckedBy` branch becomes marker-only, and the `FieldDescription` override goes with the description.
    - `SkillTrack_RecordCheckDialog` gets a `skillDescription?: string` prop and shows it under the title when it's set. Both pages pass `assessableSkillById.get(skillId)?.description`, using the map both already build.
    - By-skill also shows descriptions in its skill picker list and under the skill `Select`, through `skillDescription()`, which reads `showSkillDescription`. **Decided (2026-10-01):** remove both, along with `skillDescription()`. The record dialog is the only place a skill description shows.
  - **Done when:** the sheet has no Show section; the rows, by-skill's picker and its `Select` show no description; and the dialog shows the description on both pages. `npm run check` passes.

- [ ] **11. Approved sessions lock the entry pages** `visual`
  - **Files:** `session-by-person-content.tsx`, `session-by-skill-content.tsx`, `session-actions-sheet.tsx`, `session-content.tsx`.
  - **Do:**
    - When `session.status === "Include"`, each entry page renders only a centred message in place of everything under the navbar: an `Empty` with "This session has been approved." and a link button to the session page via `route("/orgs/[slug]/skill-track/sessions/[session_id]", …)`. This replaces the "Approved" alert, the read-only rows, and the "No linked person" / "Not an assigned assessor" / "Cannot record" alerts: an approved session says only that.
    - The navbar and its Actions sheet stay, so Recent checks is still reachable.
    - `useSessionChecksSync` stays enabled through the approved state, so a reopen brings the content back on the next poll. Don't gate its `enabled` on `isApproved`. The live switch only happens for a recording assessor, whose poll is on. Anyone else sees the change on reload, which is acceptable: they couldn't record anyway.
    - Disable the By Person and By Skill entries while approved:
      - In `session-content.tsx` they're `DropdownMenuItem asChild` + `Link` under a "Record" dropdown. Render `<DropdownMenuItem disabled>` without the `Link` while approved, as `session-menu.tsx` does with `disabled`.
      - In the Actions sheet, render the Record items as a disabled `<button>` inside `Item asChild`, like the Configure items, in place of the `Link`.
  - **Done when:**
    - approving in another browser replaces a recording assessor's open entry page with the message within about 10 s;
    - reopening brings it back;
    - the four links are disabled while approved.

    `npm run check` passes.

## Visual checkpoints

1. After Task 7, covering Tasks 6 and 7. Use two accounts, or one account in two browsers, both assigned assessors on one unapproved session. Record on one and watch the other. **Done 2026-10-01.** It produced the revisions above.
2. After Task 11, covering Tasks 10 and 11, plus the Recent checks order after an approve and reopen (Task 8).

## Out of scope

- **Session presence** ("who's here now") and push transport. That's #318, which stays parked.
- **Session configuration changes made elsewhere,** such as a person or skill added by the coordinator. The poll doesn't carry config, so the assigned lists refresh only on reload or on the page's own writes.
- **Rows hard-deleted outside approval,** such as a cascade from purging a person or skill. The session cache keeps them until the page reloads.
- **Renames.** Renaming a person or skill doesn't touch `SkillCheck.recordedAt` (or, before Task 8, `updatedAt`), so the names on cached rows are only as fresh as each row's last write, or the page load.
- **A full event history** in the Recent checks dialog, which would need #46's audit logging.
- **End-user docs** (`content/docs/skill-track/sessions.mdx`). They're the single docs pass after Stage 2, per #336.
- **A `date` field on the standalone check create and update forms,** and an edit UI for standalone checks. That's a follow-up issue, which also covers the unused `getSkillChecksCollection`.
- **Closing #317 and #318.** That's #336's housekeeping, done after this merges.
