# Session checks sync: cross-assessor live progress on the entry pages

**Date:** 2026-09-30
**Issue:** [#319](https://github.com/redcloud-nz/avut/issues/319), client half, which is Stage 2 of [#336](https://github.com/redcloud-nz/avut/issues/336). Stage 1 (PR #346) already added `SkillCheck.updatedAt`, the `Deleted` tombstone and the `status: { not: "Deleted" }` filters.
**Branch:** `feat/session-checks-sync`
**Worktree:** `.claude/worktrees/session-checks-sync`, with its dev server on 3109 (its `.dev-port`).
**DB:** no migration, on the shared `avut`. The existing `@@index([sessionId])` is enough at session sizes, which run to hundreds or low thousands of rows.
**D4H:** nothing here depends on a D4H token.
**Written against:** integration @ c59cc113

## Goal

An assessor on `by-person` or `by-skill` sees, within about 10 seconds:

- the other assessors' checks on the same assessee and skill, as a marker on the row;
- their own checks recorded from another device;
- the session being approved or reopened by someone else.

A **Recent checks** dialog in the Actions sheet lists the session's checks, newest first.

## Decisions

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

- [ ] **6. "Also checked by" marker** `visual`
  - **Files:** `src/components/skill-track/check-row.tsx`, `session-by-person-content.tsx`, `session-by-skill-content.tsx`.
  - **Do:**
    - Add an optional `otherChecks?: { assessorName: string; result: SkillCheckResultValue }[]` prop to `SkillTrack_CheckRow`. When it's non-empty, render "Also checked by Jane (Competent), Bob (…)" under the title in `text-xs text-muted-foreground`, labelled with `resultLabel`. The layout otherwise stays as it is: the title column grows and the buttons stay right-aligned.
    - Each page computes `otherAssessorChecks(data?.checks ?? [], personSelf.id)` once with `useMemo`, from `useSessionChecksSync`'s returned `data` and only when `personSelf` is set. It passes each row its entry.
  - **Done when:** with two assessors recording on one session, each sees the other's result on the matching row within about 10 s, and a removal clears it. `npm run check` passes.

- [ ] **7. Recent checks dialog** `visual`
  - **Files:** `src/components/skill-track/session-recent-checks-dialog.tsx` (new) and `src/components/skill-track/session-actions-sheet.tsx`.
  - **Do:**
    - Build `SkillTrack_SessionRecentChecksDialog` as described under Decisions → UI: a scrolling list in a `Dialog`, using the `size` prop (#334) if the default width is cramped.
    - Add a `useRecentChecksAction()` hook for `?action=recent-checks`, modelled on `useSessionConfigAction`.
    - The dialog observes through `useSessionChecks` with `refetchInterval: 10_000`, enabled while open. It gets `selfPersonId` from `getPersonSelf`.
    - In the sheet, add an "Activity" section between Record and Skill Order, with a "Recent checks" item (`HistoryIcon`). It hands over to the dialog as `handleConfigure` does, and the dialog is hosted beside `SkillTrack_SessionConfigDialogs` with `returnFocusRef={triggerRef}`.
    - Results use the org's labels. A tombstone reads "Removed by X", muted.
  - **Done when:** the dialog opens from the sheet on both pages, lists newest first, shows removed checks, updates while open (including for a viewer who isn't recording), and Back closes it. `npm run check` passes.

## Visual checkpoint

After Task 7, one checkpoint covering Tasks 6 and 7. Use two accounts, or one account in two browsers, both assigned assessors on one unapproved session. Record on one and watch the other.

## Out of scope

- **Session presence** ("who's here now") and push transport. That's #318, which stays parked.
- **Session configuration changes made elsewhere,** such as a person or skill added by the coordinator. The poll doesn't carry config, so the assigned lists refresh only on reload or on the page's own writes.
- **Rows hard-deleted outside approval,** such as a cascade from purging a person or skill. The session cache keeps them until the page reloads.
- **Renames.** Renaming a person or skill doesn't touch `SkillCheck.updatedAt`, so the names on cached rows are only as fresh as each row's last write, or the page load.
- **A full event history** in the Recent checks dialog, which would need #46's audit logging.
- **End-user docs** (`content/docs/skill-track/sessions.mdx`). They're the single docs pass after Stage 2, per #336.
- **Closing #317 and #318.** That's #336's housekeeping, done after this merges.
