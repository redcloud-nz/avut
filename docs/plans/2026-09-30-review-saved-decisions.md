# Session review: saved decisions through dialogs

**Date:** 2026-09-30
**Issues:** part of [#337](https://github.com/redcloud-nz/avut/issues/337) and [#335](https://github.com/redcloud-nz/avut/issues/335) (adds #335's "exclude all" option). Stage 2 of [#336](https://github.com/redcloud-nz/avut/issues/336).
**Branch:** `feat/session-review`, continuing after [the review cards plan](2026-09-30-session-review-cards.md). Stacked on `feat/check-lifecycle`, unpushed; everything ships in one PR.
**Worktree:** `.claude/worktrees/check-lifecycle`, dev server on 3109.
**DB:** no migration. The worktree points at the branch DB `avut_check_lifecycle`.
**D4H:** nothing here depends on a D4H token.
**Written against:** integration @ 89eb45a2, plus `feat/session-review` @ fca9019c.

## Direction

Today the review page keeps every include/exclude decision in the browser tab until Approve, so leaving the page silently throws the decisions away. That breaks the app's convention that changes happen through dialogs and are saved when the dialog saves. This plan saves each decision on the server as it's made:

- the Personnel and Skills cards' check dialogs become mutation dialogs with Save;
- the Conflicts card becomes a compact list, each row with a **Resolve** button opening a resolution dialog;
- Approve approves the saved state.

## Decisions

### Where a decision lives

- **A check marked for exclusion on an unapproved session has status `Exclude`.** Including it again sets it back to `Draft`. No new status, no migration.
  - This already fits reopen: `reopenSession` moves `Include` checks to `Pending` and leaves `Exclude` alone, so exclusions carry across a reopen.
  - `Draft` and `Pending` both mean "will be included". Restoring an excluded check to `Draft` loses a `Pending` marker, which is harmless.
- **Re-recording a check brings it back in.** Recording in a session goes through `skillCheckSessions.setSessionSkillCheck`, whose upsert `update` branch sets `status: "Draft"`; `skillChecks.updateSkillCheck` does the same. So an assessor changing a result after it was excluded makes it included again, and can reopen a resolved conflict. Agreed with the user: a new result deserves a fresh look. The same happens, as side effects of the same rule, on a notes-only edit, on re-saving the same result, and on the recorder's delete-then-Undo (which revives the tombstone as `Draft`).

### Conflicts

- A **conflict** is still a pair (assessee and skill) with more than one live check, excluded or not, so resolved conflicts stay listed.
- A conflict is **resolved** when at most one of its checks isn't `Exclude`. That covers one pick, and **exclude all** (every check `Exclude`), which the user added from #335's future options.
- Add `isConflictResolved(conflict)` (or equivalent) to `src/lib/skill-check-conflicts.ts`, so the page, the Contents card and the server agree.
- **"Resolved" is read from saved statuses, not from an explicit pick,** so some conflicts are resolved without anyone opening Resolve. These are intended (confirmed by the user at plan approval, 2026-09-30):
  - after a reopen, the previous approval's resolution (one `Pending`, the rest `Exclude`) carries over as resolved. This **reverses** the conflicts plan's rule that a group starts unpicked even after a reopen;
  - a lone check excluded in the Personnel dialog, then a second assessor recording the same pair, gives a conflict already resolved in favour of the new check;
  - "Exclude all" saved while a third check was being recorded leaves the new check as the pick.

### The mutation

- **One procedure, `skillCheckSessions.updateCheckExclusions`**, used by both the check dialogs and the Resolve dialog:
  - input: `{ sessionId, changes: [{ skillCheckId, excluded: boolean }] }`;
  - permission `skillCheckSession: ["approve"]`, as `approveSession`;
  - `assertSessionUnlocked`: an approved session is locked. That check runs before the write, so on its own it can't stop a write racing an approval, and since these writes aren't logged a racing one would be invisible. So **both `updateMany`s are guarded in their `where`**: the session isn't approved (`session: { status: { not: "Include" } }`), and the exclude write only matches `status: { in: ["Draft", "Pending"] }`, the re-include write only `status: "Exclude"`. Update `assertSessionUnlocked`'s doc comment, which justifies the check-then-write race by "at worst a stray Draft check";
  - every id must be a live check in the session, otherwise `CONFLICT` (a stale view, most likely a check deleted since the page loaded, so the client's refetch-on-conflict path picks it up; changed from `BAD_REQUEST` in Task 2's review);
  - `excluded: true` sets `Exclude`; `excluded: false` sets `Draft`, but only on a check that is currently `Exclude`. Other statuses are left alone, so re-including a `Pending` check doesn't touch it.
  - The service does the work: `SkillChecks.updateCheckExclusions` in `src/server/services/skill-checks.ts`, one `$transaction` of two `updateMany`s.
- **No audit log entry for these writes.** The user asked for this: logging every tick would flood the log. It's a deliberate exception to AGENTS.md's "always `ctx.logEvent` after state-changing operations", and a code comment on the procedure says so. The Approve entry records the outcome instead (below).
- **Cache effects:** add an `updateCheckExclusions` entry to `src/client/skill-check-sessions-effects.ts` (`createEffects<"skillCheckSessions">`) that invalidates `skillChecks.listSkillChecks.queryFilter({ organizationId, sessionId })`, following `approveSession`'s entry.
- **In the router, `updateCheckExclusions` goes before `updateSession`** (the procedures are alphabetical).

### Approving

- **`approveSession` approves the saved state:** every live check that isn't `Exclude` is stamped `Include`, the rest `Exclude`.
- **It still takes `includedCheckIds`, as a confirmation, and still stamps by those ids** (`id: { in: includedCheckIds }` → `Include`, the rest → `Exclude`), as today, not by "status isn't `Exclude`". The comparison below runs outside the transaction, so stamping by ids keeps a check that changes between the comparison and the commit out of an approval nobody confirmed.
- **The comparison:** The server computes the live non-`Exclude` set, and if it differs from `includedCheckIds` it throws `CONFLICT` ("The session's checks changed since you opened this. Review them and approve again."). That keeps "what you approve is what you saw": a check recorded or excluded by someone else while the confirm dialog is open doesn't slip through.
- `SkillChecks.assertApprovalMatchesSavedState` does the comparison and replaces `assertOneIncludedCheckPerPair`: it runs the one-check-per-pair guard on the saved included set, so an unresolved conflict can't be approved (`BAD_REQUEST`). It also returns the session's `updatedAt` and the checks' latest `updatedAt` as read, and the approve transaction re-checks both (the session update is conditional on that `updatedAt`, the stamps skip a check changed since, and a final guard fails if any check is left `Draft`/`Pending`), so a change landing between the comparison and the commit is a `CONFLICT` too.
- The Approve log description gains the counts: `Approved session "X": 14 included, 2 excluded.`

### The page

- **No local selection any more.** `selected`, `initialSelection`, `reconcileSelection`, `toggleCheck`, `pick`, and the post-approval stamping workaround (`approving`/`approvedAt`/`awaitingStampedChecks`/`showApproval`) go. "Included" is read from each check's status everywhere, with one rule (`isCheckIncluded`): not `Exclude`, before and after approval. (Reading `Include` once approved would flash every check excluded between the approval and the checks' refetch.) Delete the helpers and their tests if nothing else uses them.
- **Approve dialog** counts come from saved statuses and it sends the derived `includedCheckIds`. On `CONFLICT` it shows the error and stays open. `meta.effects` only run on success, and today's `useRefetchSessionOnConflict` only refetches `getSession`, so **extend `useRefetchSessionOnConflict` to also invalidate `skillChecks.listSkillChecks` for the session**. The lock `CONFLICT` benefits too. The Resolve and check dialogs use the same hook in their `onError`.
- **Personnel / Skills check dialog** (Task 4): a mutation dialog, Recipe "nested entity" in `mutation-dialog.md`.
  - `?action=review-person&personId=…` / `?action=review-skill&skillId=…`, owned by the page's single `?action=` parser alongside `reopen` and `approve`.
  - The dialog holds a local draft of which checks are excluded, initialised from saved statuses on open. The reset effect keys on the person (or skill) id as well as `open`, so Back/Forward between two people doesn't carry one draft into the other; close clears both params with `history: "replace"`. **Save** sends only the changed checks; **Cancel** discards. Save is disabled while nothing has changed.
  - Conflict checks are disabled with "resolve in Conflicts", as today.
  - Read-only (no Save, just Close) when the session is approved or the viewer lacks `skillCheckSession: ["approve"]`.
- **Conflicts card** (Task 3): compact rows.
  - Each row: "assessee · skill", the agreement label ("Both: Competent" / "Results differ"), and a status: **Unresolved** (destructive text), **Picked: <result>, <assessor>**, or **All excluded**. A **Resolve** button on the right (**Change** once resolved). On a phone the button drops below the text.
  - Description as today ("2 unresolved conflicts" / "All 2 conflicts resolved").
  - Buttons behind `<Protect permissions={{ skillCheckSession: ["approve"] }}>` and hidden on an approved session.
- **Resolve dialog** (Task 3): `?action=resolve&personId=…&skillId=…`.
  - Body: today's side-by-side radio panes (auto-fit grid, stacked on a phone), plus a final **Exclude all** radio option below the panes.
  - Starts on the saved state: the one non-excluded check, "Exclude all" if every check is excluded, or nothing if unresolved. Resets on open and on a change of the (personId, skillId) pair.
  - **Save** (disabled until a choice is made) sends `excluded: true` for every other check and `excluded: false` for the pick.
- The **session page's Contents card** counts unresolved conflicts only.
- A stale `?action=` (a dialog for a person, skill or conflict that no longer exists, or a mutation dialog on an approved session) is cleared, as the page already does for `reopen`/`approve`.

## Tasks

### Task 1: `updateCheckExclusions` and resolved-conflict helper

- [x] fix(skill-track): serialize exclusion writes with approval on the session row

**Files:** `src/lib/skill-check-conflicts.ts`, `src/lib/skill-check-conflicts.test.ts`, `src/client/skill-check-sessions-effects.ts`, `src/server/services/skill-checks.ts`, `src/server/services/skill-checks.test.ts` (if the service has tests for similar functions), `src/trpc/routers/skill-check-sessions-router.ts`, `src/trpc/routers/skill-check-sessions-router.test.ts`.

**Do:**

- Add `isConflictResolved` (a conflict with at most one non-`Exclude` check) to the conflicts helper, with tests: unresolved, one pick, all excluded.
- Add `SkillChecks.updateCheckExclusions(ctx, sessionId, changes)` and the `updateCheckExclusions` procedure as in Decisions → The mutation. No `logEvent`, with the comment explaining why.
- Router tests: excludes and re-includes; the status/session guards (an approved session's checks aren't touched even past the up-front lock check); re-including leaves a `Pending` check alone; rejects an id from another session or a `Deleted` check (`BAD_REQUEST`); rejects on an approved session (`CONFLICT`, as the lock); needs the approve permission.

**Done when:** tests pass; `npm run check` passes.

### Task 2: approve the saved state, and the page reads it

- [x] feat(skill-track): approve the saved review state and read it on the review page

One commit, because each half breaks the page without the other: the server would reject the page's local selection, and the page would have no way to save a decision.

**Files:** `src/trpc/routers/skill-check-sessions-router.ts` and its test, `src/trpc/messages.ts` if the new message lives there, `src/components/skill-track/use-refetch-session-on-conflict.ts`, `src/components/skill-track/approve-session.tsx`, `src/components/skill-track/session-review-content.tsx`, `src/components/skill-track/session-review-conflicts.tsx`, `src/components/skill-track/session-review-coverage.tsx`, `src/components/skill-track/session-contents.tsx`, `src/lib/skill-check-conflicts.ts` and its test.

**Do:**

- **Server,** as Decisions → Approving: compute the live non-`Exclude` set; `CONFLICT` if it differs from `includedCheckIds` (as a set); the one-per-pair guard on it; stamp by ids as today; the counts in the log description; update the doc comment. Tests: approves when the ids match; `CONFLICT` when a check was added, excluded or re-included since; `BAD_REQUEST` for an unresolved conflict; an `Exclude` check stays `Exclude`; the log description has the counts. Update existing fixtures so excluded checks are `Exclude` in the DB.
- **Page,** as Decisions → The page: remove `selected` and the approval-stamping workaround, and read "included" from statuses. **As an interim until Tasks 3 and 4,** the existing Conflicts radios and the check dialog's checkboxes call `updateCheckExclusions` directly, saving on click. Approve's blocked reason, the Conflicts card description and the Contents card use `isConflictResolved`. The Approve dialog sends the derived ids and handles `CONFLICT` with the extended `useRefetchSessionOnConflict`. Delete `initialSelection`/`reconcileSelection` and their tests if unused.

**Done when:** router tests pass; on the dev session a pick or an exclusion survives a reload, and approve and reopen work end to end with counts matching what's saved; `npm run check` passes.

### Task 3: Conflicts card rows and the Resolve dialog (`visual`)

- [ ] Not started

**Files:** `src/components/skill-track/session-review-conflicts.tsx`, `src/components/skill-track/resolve-conflict.tsx` (new), `src/components/skill-track/session-review-content.tsx`.

**Do:** the compact rows and `SkillsModule_ResolveConflict_Dialog`, as in Decisions → The page. The dialog follows `docs/patterns/mutation-dialog.md` (controlled `…_Dialog`, reset on open, `DialogHeader`/`DialogBody`/`DialogFooter`, mutation error shown in the dialog, `useRefetchSessionOnConflict` on error). Move the radio pane markup, and Task 2's interim save-on-click, from the card into the dialog behind Save. Wire `?action=resolve&personId&skillId` into the page's `?action=` owner, with stale-param clearing.

**Done when:** a conflict can be resolved, changed, and set to exclude all, and the state survives a reload; `npm run check` passes.

### Task 4: Personnel / Skills check dialogs save (`visual`)

- [ ] Not started

**Files:** `src/components/skill-track/session-review-coverage.tsx`, `src/components/skill-track/session-review-content.tsx`, possibly a new `src/components/skill-track/review-checks-dialog.tsx`.

**Do:** turn the check dialog into a mutation dialog, as in Decisions → The page, with `?action=review-person&personId` / `?action=review-skill&skillId` and stale-param clearing. Replace Task 2's interim save-on-click with a draft and Save. Excluded counts and badges read saved statuses.

**Done when:** excluding and re-including checks saves, survives a reload, and Cancel discards; `npm run check` passes.

### Task 5: docs

- [ ] **Deferred** (2026-09-30): end-user docs wait until all the skill check session work (#336) is complete.

## Out of scope

- An audit trail of individual exclusions (declined; see Decisions → The mutation).
- A reason note on an exclusion, sending a check back for reassessment, bulk "pick the latest", co-assessor credit (#335's other future options).
- Excluding checks from anywhere other than the review page.
