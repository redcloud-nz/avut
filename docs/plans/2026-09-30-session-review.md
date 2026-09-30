# Session review: conflicts card, header Approve and confirm

**Date:** 2026-09-30
**Issues:** [#335](https://github.com/redcloud-nz/avut/issues/335) (conflict resolution), and part of [#337](https://github.com/redcloud-nz/avut/issues/337) (the rest of the review page). Stage 2 of [#336](https://github.com/redcloud-nz/avut/issues/336).
**Branch:** `feat/session-review`, cut from `feat/check-lifecycle` (#336 Stage 1, unpushed). Both ship in one PR from this branch's tip.
**Worktree:** `.claude/worktrees/check-lifecycle`, whose dev server runs on 3109 (its `.dev-port`).
**DB:** no migration. The worktree already points at the branch DB `avut_check_lifecycle`, which has Stage 1's migration.
**D4H:** nothing here depends on a D4H token.
**Written against:** integration @ 89eb45a2, plus `feat/check-lifecycle` @ a9930de6.

## Direction

The review page is moving towards **summary cards that surface what needs attention**, not a full list of every check. This plan adds the first such card, **Conflicts**. It also moves Approve and Reopen into the page header and puts a confirm dialog in front of Approve. The existing checks list card stays as it is: same table, same checkboxes.

Other cards from #337 come later: the summary counts, "Not assessed", and check details. See Out of scope.

## Decisions

### What a conflict is

- A **conflict** is one assessee and skill in a session that has more than one live check (any status but `Deleted`), whether or not the results agree.
  - `SkillCheck`'s unique key includes the assessor, so more than one check on a pair means more than one assessor.
  - Counting checks rather than distinct `assessorId`s also catches the case where both assessors were purged, leaving two checks with `assessorId: null`.
- **One shared, pure helper** computes conflict groups: `src/lib/skill-check-conflicts.ts`. The client and server run the same code, so they can't disagree. It's used by:
  - the server guard in `approveSession`;
  - the review page;
  - the session page's Contents card.
- **No `getSessionConflicts` procedure.** #335 suggested one, but every place that shows conflicts already loads the session's checks with `listSkillChecks`. A procedure would only add a round trip.

### The server rule (#335)

- `approveSession` rejects an `includedCheckIds` that holds more than one check for the same assessee and skill.
- The check lives in `SkillChecks.assertOneIncludedCheckPerPair` in `src/server/services/skill-checks.ts`. It throws `ValidationError`, which becomes `BAD_REQUEST`.
- It loads the session's live checks that are in `includedCheckIds` and runs the shared helper over them. Ids from another session, and `Deleted` checks, are ignored, just as the stamping `updateMany`s ignore them.
- The server allows **at most** one included check per pair. The page asks for **exactly** one: Approve is disabled until every conflict group has a pick.

### Selection

- The page keeps a single `selected: Set<SkillCheckId>`, as today, and both cards read and write it.
  - Picking a radio in the Conflicts card swaps that group's ids in `selected` for the picked id.
  - There's no separate state for conflict picks.
- **The checks list card stays as it is, with one change.** A check that belongs to a conflict group is decided in the Conflicts card:
  - its checkbox in the list shows the pick but is disabled;
  - the assessee's select-all toggles only the checks outside conflict groups.

  Without this, ticking two checks in the list could produce a selection the server rejects.

### What starts selected

- **A check outside any conflict group** starts ticked unless it's `Exclude`. That's today's rule. It covers a first review, `Pending` checks after a reopen, and checks recorded since.
- **A conflict group** starts with nothing picked, with one exception:
  - If the group has **exactly one** `Pending` check and **no** `Draft` check, that `Pending` check starts picked. It was included before the reopen, and nothing in the group has been recorded or edited since.
  - Two or more `Pending` checks start with nothing picked. That happens in sessions approved before Task 3's guard, which can hold two `Include` checks on one pair; a reopen turns both into `Pending`.
  - Any `Draft` check in the group means it needs a fresh pick. A check added after the reopen is `Draft`, and so is one edited after it.

### Keeping the selection right when the checks refetch

The page stays mounted while the checks refetch, so it has to apply the same rules to new data.

- **Each conflict group has a signature:** its members' `id:status:updatedAt`, sorted.
- **When a group's signature changes,** its ids are removed from `selected` and the starting rules apply again.
  - A re-record keeps the row's id but changes its `status` and `updatedAt`, so it clears the pick.
  - A check joining or leaving the group does too.
- **An unchanged group** keeps the user's pick.
- **A check that leaves a group** (the group shrinks to one check) falls back to the outside-group rule: ticked unless `Exclude`. So does a new check outside any group.
- **A check that was already on its own** keeps the user's tick or untick, as today.
- **Where the rules live.** They are pure functions, `initialSelection(checks)` and `reconcileSelection(prevChecks, nextChecks, selected)`, in `src/lib/skill-check-conflicts.ts`. Task 2 unit-tests them. The page just calls them.

### The Conflicts card

- **It only appears when the session has at least one conflict.** It sits above the checks list card.
- **The header** reads "Conflicts". Its description says how many are left to resolve, for example "Resolve 2 conflicts before approving." When all are picked, it says so instead.
- **Each group shows** the assessee and skill, and a line saying whether the results agree: "Both: Competent", "All 3: Competent" or "Results differ".
- **One `RadioGroup` item per check** (`src/components/ui/radio-group.tsx`), showing:
  - the result;
  - the assessor (`assessorDisplayName` from `src/lib/schemas/skill-check.ts`). Build its `assessor` from the page's `assessorById` map; it falls back to `assessorLabel` for purged assessors.
  - the time recorded (`formatDateTime`, with the viewer's preferences from `usePreferences()` in `src/hooks/use-preferences`);
  - the notes, in full. Conflict notes are usually why one check gets picked.
- **When the session is approved,** the radios are disabled and show the stored `Include` check. This is the record of how each conflict was resolved.

### The header: Approve, Reopen and who can act

- `Saratoga.Actions` in the review page header holds:
  - **Approve**, while the session isn't approved. It opens the confirm dialog, and is disabled while any conflict group has no pick. A tooltip gives the reason ("Resolve 2 conflicts to approve"), and the Conflicts card says the same.
  - **Reopen**, while it's approved. It uses `SkillsModule_ReopenSession_Dialog`.
- **Both buttons are gated** with `<Protect permissions={{ skillCheckSession: ["approve"] }}>`, per `docs/patterns/protect-permission-gating.md`.
- **The "Approved" alert stays.** Its text changes to point at the header's Reopen, rather than linking to the session page.
- **The checks list card's footer, with its Approve button, goes away.**
- **Who resolves conflicts:** whoever can approve. For anyone else, `useHasPermission({ skillCheckSession: ["approve"] })` is false, so the radios and checkboxes are disabled.

### The confirm dialog and `?action=` (#337)

- **Approve opens a confirm dialog** following `docs/patterns/mutation-dialog.md`: "Approve 42 checks, exclude 3. The session will be locked until it's reopened."
- **The dialog owns the `approveSession` mutation.** The page's post-approval fallback (`awaitingStampedChecks`) and the reset when the session is reopened (d0e7122f) move with it.
- **One `?action=` owner on the page.** A single `useQueryState("action", parseAsStringLiteral(["reopen", "approve"]))` drives both dialogs. Two separate parsers would each read the other's value as `null`, the trap noted in `session-config-dialogs.tsx`.
  - `reopen` opens only while the session is approved (`isApproved`), as in `session-menu.tsx`.
  - `approve` opens only when the session isn't approved, the viewer can approve, and no conflict is left unpicked. Otherwise the param is cleared in an effect.

### Docs

- **Scope:** only the "5. Review and approve" section of `content/docs/skill-track/sessions.mdx` changes, and only its text.
- **No screenshots:** #336's docs pass after Stage 2 captures them all at once.

## Tasks

### Task 1: Shared conflict helper

- [x] feat(skill-track): add a shared skill-check conflict helper

**Files:**

- `src/lib/skill-check-conflicts.ts` (new)
- `src/lib/skill-check-conflicts.test.ts` (new)

**Do:**

- **`groupChecksByPair<T extends { id: string; assesseeId: string; skillId: string; status: string }>(checks: T[]): Map<string, T[]>`**
  - Groups the live (non-`Deleted`) checks by `${assesseeId}:${skillId}`, keeping insertion order.
  - The constraint is structural, so the server can pass raw Prisma `select` rows and the client can pass `SkillCheck`s. Each gets its own `T` back.
- **`findConflicts(checks)`**: returns only the groups with more than one check, as `{ key, assesseeId, skillId, checks }[]`.
- **`pairKey(assesseeId, skillId)`.**
- **No server imports:** the client uses this file too.

**Done when:**

- Tests cover these cases:
  - no conflicts;
  - two assessors on one pair;
  - three assessors on one pair;
  - a `Deleted` check is ignored and doesn't make a conflict;
  - two `assessorId: null` checks on one pair count as a conflict;
  - checks on different pairs don't group together.
- `npm run check` passes.

### Task 2: Selection rules as pure functions

- [x] feat(skill-track): add the review page's selection rules to the conflict helper

**Files:**

- `src/lib/skill-check-conflicts.ts`
- `src/lib/skill-check-conflicts.test.ts`

**Do:**

- Add `initialSelection(checks)` and `reconcileSelection(prevChecks, nextChecks, selected)`. Each returns a new `Set` of check ids.
- Implement the rules in Decisions ("What starts selected" and "Keeping the selection right when the checks refetch") exactly, using the group signature.
- The input type is Task 1's structural type plus `updatedAt: string`.

**Done when:**

- Tests cover checks outside a conflict group:
  - `Draft`, `Pending` and `Include` start ticked;
  - `Exclude` starts unticked.
- Tests cover conflict groups on load:
  - with no `Pending` check, nothing is picked;
  - exactly one `Pending` and no `Draft`: that check is picked;
  - two `Pending`: nothing is picked;
  - one `Pending` and one `Draft`: nothing is picked.
- Tests cover `reconcileSelection`:
  - a third assessor's check joining a group clears its pick;
  - an existing member that's re-recorded (same id, now `Draft`, new `updatedAt`) clears the pick;
  - an unchanged group keeps the user's pick;
  - a check the user had ticked that then becomes part of a group ends up with nothing picked;
  - a group that shrinks to one check leaves that check ticked unless it's `Exclude`;
  - a check the user unticked stays unticked across a refetch that changes other rows;
  - a new check outside any group is ticked.
- `npm run check` passes.

### Task 3: `approveSession` enforces one included check per pair

- [x] feat(skill-track): reject approving more than one check per assessee and skill

**Files:**

- `src/server/services/skill-checks.ts`
- `src/trpc/routers/skill-check-sessions-router.ts`
- `src/trpc/routers/skill-check-sessions-router.test.ts`

**Do:**

- Add `assertOneIncludedCheckPerPair(ctx, sessionId, includedCheckIds)` to the service. It:
  - loads the session's checks with `status: { not: "Deleted" }` and `id: { in: includedCheckIds }`, selecting `id`, `assesseeId`, `skillId` and `status`;
  - runs `findConflicts` over them;
  - throws `ValidationError` if any are found, naming how many pairs conflict and the first pair's ids.
- Call it in `approveSession`, after `assertSessionUnlocked` and before the transaction.
- Add the `BAD_REQUEST` to `approveSession`'s JSDoc `@throws`.
- Follow `src/server/services/CLAUDE.md`.

**Done when:**

- Router tests cover these cases:
  - two included checks on one pair are rejected with `BAD_REQUEST`, and nothing is written;
  - including one of the two and leaving out the other approves, stamping `Include` and `Exclude`;
  - an included `Deleted` check doesn't count towards a conflict;
  - an id from another session doesn't count.
- `npm run check` passes.

### Task 4: Conflicts card `visual`

- [x] feat(skill-track): add the Conflicts card to the session review page

**Files:**

- `src/components/skill-track/session-review-conflicts.tsx` (new)
- `src/components/skill-track/session-review-content.tsx`
- `src/app/(wrapper)/(authenticated)/orgs/[slug]/skill-track/sessions/[session_id]/review/page.tsx`:
  - prefetch `listSkillChecks`, per `docs/patterns/detail-page-data-fetching.md`;
  - prefetch the viewer's preferences if `usePreferences` would otherwise suspend on the client.

**Do:**

- **Build the Conflicts card** described in Decisions. Its props are:
  - the conflict groups;
  - `selected`, and a `pick(groupIds, checkId)` callback;
  - lookups for assessees, skills and assessors;
  - `disabled`;
  - `showApproval`.
- **Wire the page:**
  - Replace the `useState` initial selection with `initialSelection`, and the `prevSkillChecks` diff with `reconcileSelection`.
  - Render the card above the checks list card when `findConflicts(skillChecks)` is non-empty.
- **Change the checks list card only as Decisions → Selection says:**
  - checks in a conflict group show the pick, with the checkbox disabled;
  - select-all toggles only the checks outside conflict groups.
- **Gating:**
  - Disable the controls for non-approvers (`useHasPermission`).
  - Disable the existing footer Approve button while any group is unpicked. Task 5 moves this button to the header.

**Done when:**

- A session with two assessors' checks on one pair shows the card with nothing picked, and Approve is disabled. Picking one enables it, and the list card's checkboxes reflect the pick.
- After approve and then reopen, the previously included check is picked.
- On refetch, the pick is cleared both when a third assessor records into the group and when an existing one re-records.
- An approved session shows the resolved picks read-only.
- `npm run check` passes.

### Task 5: Header Approve/Reopen and the approve confirm dialog `visual`

- [ ] (commit subject goes here once done)

**Files:**

- `src/components/skill-track/approve-session.tsx` (new)
- `src/components/skill-track/session-review-content.tsx`

**Do:**

- **Build `SkillsModule_ApproveSession_Dialog`**, following `docs/patterns/mutation-dialog.md`.
  - It's a `Dialog` confirming a state change, driven by its host through `open`/`onOpenChange`, like `reopen-session.tsx`.
  - Its props are `session`, `includedCheckIds` and the included and excluded counts.
  - The body reads: "Approve {included} checks, exclude {excluded}. The session will be locked until it's reopened."
  - It owns the `approveSession` mutation, taking over the effects, the conflict refetch and the toasts from the page. It resets the mutation on open.
- **Keep the post-approval fallback working.** The page needs `awaitingStampedChecks` so that it shows `selected` until the stamped checks arrive. Either:
  - lift a `lastApprovedAt` timestamp out of the dialog's `onSuccess`, or
  - keep the mutation in the page and pass it to the dialog.

  Choose the simpler one. Keep the reset-on-reopen behaviour.

- **Add the page-level `?action=` state** (`["reopen", "approve"]`), with the open conditions from Decisions. Clear a stale `approve` in an effect, as `session-config-dialogs.tsx` does.
- **Update the header.** `Saratoga.Actions` gets Approve (with the tooltip reason while disabled) or Reopen, both behind `<Protect>`.
- **Remove the checks list card's footer.**
- **Reword the "Approved" alert** to point at the header's Reopen.

**Done when:**

- Approve in the header opens the confirm with the right counts, and confirming approves and closes it.
- Reopen in the header works.
- Approve → Reopen → Approve works, with no stale "Submitted" state.
- A pasted `?action=approve` doesn't open the dialog on an approved session or a draft with unpicked conflicts, and the param is cleared.
- Neither button shows without the approve permission.
- `npm run check` passes.

### Task 6: Conflict count on the session page `visual`

- [ ] (commit subject goes here once done)

**Files:**

- `src/components/skill-track/session-contents.tsx`

**Do:**

- **Add a Contents card row** when the session isn't approved and `findConflicts(skillChecks)` is non-empty.
  - It reads "{n} conflicts to resolve", with "before approval" as its description.
  - It links to the review page.
- **Style it** like the existing Skill checks `Item` row, with a warning accent. Check how `Badge` and `Item` variants show warnings elsewhere before inventing one.

**Done when:**

- The row appears with the right count on a session with conflicts.
- It goes away once the session is approved or the conflicts are gone.
- `npm run check` passes.

### Task 7: Docs: review and approve

- [ ] (commit subject goes here once done)

**Files:**

- `content/docs/skill-track/sessions.mdx`

**Do:**

- **Rewrite "5. Review and approve"** to cover:
  - the checks list;
  - the Conflicts card: what a conflict is, picking one, and Approve staying disabled until every conflict has a pick;
  - Approve and Reopen in the header;
  - the confirm dialog.
- **Keep the existing callout.**
- **Mention the conflict row** on the session page.
- **Add no new `<Screenshot>` ids.**

**Done when:**

- The section matches the built page.
- `npm run check` passes.

## Out of scope

- **More review cards from #337,** to be designed later:
  - summary counts (included, excluded, conflicts);
  - "Not assessed";
  - per-check details (assessor, time, notes) in the checks list;
  - a Show filter;
  - a phone layout for the list.
- **#319's client half:**
  - the delta poll;
  - "already checked by X";
  - the recent-checks dialog.
- **#335's future options:**
  - exclude all;
  - the reviewer recording their own result;
  - sending a check back for reassessment;
  - bulk "pick the latest";
  - co-assessor credit;
  - a reason note.
- **An approver stamp on the session.** It needs a migration.
- **Renaming `approveSession`'s `sessionId` input to `skillCheckSessionId`.** That belongs to #328.
- **Docs screenshots.** They come in #336's docs pass.
