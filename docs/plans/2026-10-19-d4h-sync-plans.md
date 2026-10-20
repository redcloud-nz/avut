# Plan: Persisted batch update plans for D4H team sync

**Date:** 2026-10-19
**Branch:** `fix/d4h-sync-plans` in `.claude/worktrees/d4h-sync`
**DB:** adds a migration. Run `npm run db:branch d4h-sync` before Task 1's `migrate dev`. Stop the dev server and Prisma Studio first, and ask before running `migrate dev`.
**Written against:** integration @ 095add1a
**Issues:** fixes #120, #144, #164. Spec: [`docs/specs/2026-09-10-d4h-linking.md`](../specs/2026-09-10-d4h-linking.md) §6.3, §6.5, §7, §8.

## Background

Today `planD4HTeamSync` builds a plan and returns it with a `planToken`. `applyD4HTeamSync` then fetches both sides again, builds the plan again, compares tokens, and applies the fresh plan. That design has three open problems:

- **#120:** the token hashes only the D4H side, so an AVUT-side change between preview and apply goes unnoticed, and the user commits a plan they never saw.
- **#164:** nothing stops two applies for one team from running at once. The crash itself is gone: cb14034c catches the P2002 and takes over the row the other request created. But in the real incident, reopening the dialog re-fetched the preview while the first apply was still running. That preview included the first apply's partial writes, so its token matched and the second apply overlapped the first.
- **#144:** members with a blank email are already skipped (`missing-email`, b84bc582). D4H members who share a non-blank email are still merged silently onto one person.

Reading the code also turned up a related bug, part of the #144 family. A member who is deleted and re-created in D4H gets a new `d4hMemberId` but keeps the same email. The plan then has both an addition (the new id) and an archival (the old id) for the same membership. Apply first takes the membership over for the new id, then archives it. The person ends up archived even though they're in D4H, and the next sync reactivates them.

## Decisions

### The table

- **Persist the plan.** A new table, `BatchUpdatePlan`, is generic across kinds of bulk operation. Planning writes the plan as a row, and executing applies _that row's items_: it doesn't plan again or fetch D4H again. `planToken`, `computePlanToken`, `StalePlanError`, `runTeamSync` and its `requireFreshMatch` are removed.
- **Columns:** `id`, `organizationId` (FK to Organization, cascade), `kind` (string, e.g. `"d4h-team-sync"`), `targetType` and `targetId` (here `"Team"` and the team id), `status`, `payload Json`, `outcomes Json?`, `createdById` (FK to User, SetNull), `createdAt`, `executionStartedAt?`, `completedAt?`, `logBatchId?`. Index on `(organizationId, kind, targetType, targetId, status)`. Mapped as `batch_update_plans`.
- **The lock key is `(kind, targetType, targetId)`.** A plan's **lock key** is these three fields, and every lifecycle rule below applies only among plans with the same lock key: one execution at a time, superseding, and `findExecuting`. A D4H sync plan for a team never blocks or supersedes a plan of another kind on the same team, and vice versa. Wherever the service takes a `target` argument, that argument is the lock key, not only `targetType`/`targetId`.
- **Status enum `BatchUpdatePlanStatus`:** `Pending → Executing → Completed | Failed`, plus `Superseded`. There's no `Expired` status: the cleanup job deletes expired rows, and claiming refuses a `Pending` plan whose `createdAt` is more than 24 hours old.
- **Generic vs D4H-specific.**
  - `src/server/services/batch-update-plans.ts` owns the lifecycle: create, claim, finish, supersede, cleanup. It knows nothing about D4H, and it treats the payload and outcomes as values a per-kind Zod schema validates.
  - `d4h-team-sync.ts` owns the D4H payload, the builder and the executor.
  - There's no executor registry or framework until a second kind exists.

### Lifecycle and concurrency

- **One execution per target, enforced in the service, with no partial unique index.** `claim(ctx, planId, now)` runs three separate statements, in this order:
  1. **Claim own row:** `updateMany({ where: { id, organizationId, status: "Pending", createdAt: { gt: now - PLAN_TTL_MS } }, data: { status: "Executing", executionStartedAt: now } })`. A `count` of 0 means the plan isn't claimable. Read the row back and throw `ConflictError`:
     - if a non-stale `Executing` plan with the same lock key exists: "A sync of this team is already running"
     - otherwise, by its status: already run / superseded / expired
     - "not found" becomes `NotFoundError`
  2. **Check contention:** after the claim has committed, look for any _other_ plan with the same lock key that is `Executing` with `executionStartedAt` inside `EXECUTION_STALE_MS`. If there is one, set this plan back to `Superseded` and throw `ConflictError("A sync of this team is already running")`.
  3. **Supersede:** only once the check has passed, `updateMany` the other `Pending` plans with the same lock key to `Superseded`, so a preview left open in another tab can't be executed afterwards.

  Each claim commits before its check runs, so of two simultaneous claims, at least the later one sees the other. In the worst case both back off, which is safe. No statement locks two rows in one transaction, so there's no deadlock. It needs no interactive transaction and no raw SQL, so it works under `prisma-mock`.

  Steps 1 and 2 are exported as `claimRow` and `checkContention` (with `claim` composing them), so a test can interleave two claims.

- **Backing off.** A plan that backed off in step 2 ends up `Superseded`. A retry of it gets "already running" while the other run is going, because step 1's message checks for an executing plan first.
- **`finish` is conditional on `status: "Executing"`.** If cleanup has already marked a run `Failed`, a late `finish` doesn't flip it back.
- **Stale execution.** An `Executing` plan whose `executionStartedAt` is more than 10 minutes old counts as dead: `checkContention` and `findExecuting` ignore it, and cleanup marks it `Failed`. This relies on the function timeout being shorter: `vercel.json` sets no `maxDuration`, so the 300-second default applies.
- **Unlink supersedes.** `unlinkTeamFromD4H` supersedes the team's `Pending` `d4h-team-sync` plans, using `BatchUpdatePlans.supersedePending(ctx, { kind: "d4h-team-sync", targetType: "Team", targetId })` in the same `$transaction` as the unlink.

### The D4H payload and executor

- **The payload carries everything execution needs:**
  - `d4hTeamId`
  - the incoming D4H details for each add, update, reactivate and relink item
  - `before` values for update and metadata items
  - the incoming team and org fields

  So execution needs no D4H token and no D4H fetch.

- **Execute guards before parsing.** It refuses (`ConflictError`) unless all of these hold: `kind === "d4h-team-sync"`, `targetType === "Team"`, the team is still `Active` and D4H-linked, and `payload.d4hTeamId === team.d4h.d4hTeamId`. The last one stops an unlink-then-relink-elsewhere from executing the old team's plan.
- **Stable item ids:** each item has an `itemId`, a string unique within the plan such as `add:<d4hMemberId>` or `archive:<teamMembershipId>`. The user skips items by id. Execute takes `skipItemIds: string[]`.
- **The executor checks each item's precondition at execute time instead of rejecting the plan.** Each item records an outcome: `applied`, `skipped-by-user`, or `skipped-changed` with a reason. Preconditions:
  - **add**, run in this order:
    - Any membership on this team already linked to this `d4hMemberId` gives `skipped-changed: already-linked`.
    - Look up the person by email. If they're `Deleted`, give `skipped-changed: person-in-rubbish-bin`.
    - Find the person's membership on this team:
      - none: create it (keeping the existing P2002 take-over fallback)
      - manual and not `Deleted`: take it over
      - linked to another D4H member: `skipped-changed: linked-to-another-member`
      - `Deleted`: `skipped-changed: membership-in-rubbish-bin`
  - **update:** the membership isn't `Deleted`, its `d4hMemberId` is unchanged, and the stored D4H details equal the plan's `before`.
  - **reactivate:** it's still `Archived` and still linked to the same `d4hMemberId`.
  - **archive:** it's still `Active` and still linked to the same `d4hMemberId`.
  - **relink:** it isn't `Deleted`, it's still linked to `previousD4hMemberId`, and no other membership on the team is linked to the new id.
  - **metadata:** each field is written only if its current value still equals `before`. Fields that changed under the plan are left alone and reported (`Organization_D4H` is shared across teams). The item is skipped when no fields remain.
- **Execution order and errors.** Items run in the order add, relink, update, reactivate, archive, metadata. If an item throws an unexpected error, record the outcomes so far, mark the plan `Failed`, and rethrow. Otherwise mark it `Completed`.
- **`lastSyncedAt` keeps its meaning,** "AVUT reflects D4H as of this time". On a `Completed` finish, the executor sets `Team_D4H.lastSyncedAt` (and `Organization_D4H.lastSyncedAt` for an org-bearing team) to the plan's `createdAt`, the time of the snapshot. It isn't part of the skippable metadata item, and a `Failed` run doesn't bump it.

### Plan builder rules

- **Skip order:** the blank-email check (`missing-email`) runs before duplicate detection, so members with blank emails aren't reported as `duplicate-email`.
- **#144, duplicate emails:** skip every D4H member whose normalised email (trimmed, lowercased) appears more than once in the D4H team and who isn't already matched to a membership by `d4hMemberId`. The skip reason is `duplicate-email`, and the dialog lists them. Members matched by id keep updating as normal.
- **Re-link:** a D4H member who isn't matched by id, has a unique email, and whose email belongs to the person on a non-`Deleted`, D4H-linked membership of this team, where that membership's `d4hMemberId` is no longer in D4H, becomes a `relink` item. Executing it rewrites `d4hMemberId` and the D4H details, and reactivates the membership if it's archived. That membership gets no archival item.
- **Membership in the Rubbish bin:** a D4H member whose person's membership on this team is `Deleted` is skipped at plan time with reason `membership-in-rubbish-bin`, so it doesn't fail as `skipped-changed` on every sync.
- **Linked to another member:** a D4H member not matched by id, whose email belongs to the person on a membership of this team linked to a _different_ D4H member who is still in D4H, is skipped at plan time with reason `linked-to-another-member`. It's neither a relink nor a duplicate, and as an add it would fail as `skipped-changed` on every sync. (Found during Task 3.)

### Router, flows and UI

- **A preview while a sync runs.** `planD4HTeamSync` becomes a mutation, `createD4HTeamSyncPlan`, because it now writes a row. It returns `{ status: "in-progress" }` without building a plan when `findExecuting` finds a plan for the team, and `{ status: "ready", planId, plan }` otherwise.
- **Link and create-from-D4H** build a plan and execute it straight away, with nothing skipped, through the same executor (`syncImmediately`). There's one code path, and the first sync still runs in the link's `LogBatch`. `linkTeamToD4H` keeps a `{ plan }` output with `counts` and `skipped`, since the link toast reads them.
- **Cleanup:** a daily cron at `/api/cron/cleanup-batch-update-plans` copies the `purge-rubbish` route shape: the same bearer-secret check, with a `src/server/cron/` binding. It marks stale `Executing` plans `Failed`, then deletes every plan older than 24 hours that isn't `Executing`. Completed plans aren't kept: the `LogBatch` already records what happened.
- **Plan rows aren't audited themselves.** They're bookkeeping, like `lastSyncedAt`. Executing one writes the same per-item `logEvent`s under the `d4h-team-sync` (or `d4h-team-link`) `LogBatch` as today, and the plan stores `logBatchId`. `createD4HTeamSyncPlan`'s doc comment says so.
- **Permissions:** creating and executing a plan need `team: ["update"]`, as today. Executing loads the plan by `id` and `organizationId`. Any user with the permission can execute any pending plan in the org; it doesn't have to be the one who created it.
- **Dialog behaviour.** The dialog can't be dismissed while Apply is pending, and reopening it no longer `reset()`s an in-flight mutation. When the server returns `in-progress`, the dialog shows "A sync of this team is running" with Apply disabled, and re-polls every few seconds.

## Tasks

Every task's commit passes `npm run check` (whole-project tsc). The new D4H code is added beside the old path in Tasks 3–5, and Task 6 switches over and deletes the old path in one commit.

### Review group 1: table and lifecycle

- [x] **1. `BatchUpdatePlan` model and its schema file** — feat(db): add BatchUpdatePlan model and schema
  - **Files:** `prisma/schema.prisma`, `prisma/migrations/<ts>_batch_update_plan/migration.sql`, `src/lib/schemas/batch-update-plan.ts` (new).
  - **Do:**
    - Add the model and the `BatchUpdatePlanStatus` enum from Decisions, with relations on `Organization` and `User`.
    - `npm run db:branch d4h-sync`, then, with permission, `npm run prisma migrate dev --name batch_update_plan`.
    - The schema file exports `BatchUpdatePlanId` (`zodNanoId16` brand plus `create()`, like `TeamMembershipId` in `src/lib/schemas/team-membership.ts`) and `BatchUpdatePlanStatus` (a Zod enum matching the Prisma enum).
  - **Done when:** the migration applies to `avut_d4h_sync`, `npx prisma generate` succeeds, and `npm run check` passes.

- [x] **2. Generic plan lifecycle service** — feat(services): add BatchUpdatePlan lifecycle service
  - **Files:** `src/server/services/batch-update-plans.ts` (new), `src/server/services/batch-update-plans.test.ts` (new).
  - **Do:** follow `src/server/services/CLAUDE.md` (an `OrgServiceContext`, domain errors from `src/lib/errors.ts`). Export:
    - `create(ctx, { kind, targetType, targetId, payload })` returns the row (id from `BatchUpdatePlanId.create()`, `createdById: ctx.userId`).
    - `requireById(ctx, planId)` is scoped to the org and throws `NotFoundError`.
    - `type PlanTarget = { kind, targetType, targetId }`, the lock key. Every query below filters on all three.
    - `findExecuting(ctx, target, now)` returns the non-stale `Executing` plan or `null`.
    - `claimRow`, `checkContention` and `claim`, exactly the three-step sequence from Decisions.
    - `supersedePending(ctx, target)` returns the `updateMany` `PrismaPromise`, so the unlink can put it in its `$transaction`.
    - `finish(ctx, planId, { status: "Completed" | "Failed", outcomes, logBatchId })`, conditional on `Executing`.
    - `runCleanup(prisma, now)` takes the bare client, like `Trash.runAutoPurge`.
    - Constants `PLAN_TTL_MS` (24h) and `EXECUTION_STALE_MS` (10min).
    - The `payload` and `outcomes` types are `unknown` here; callers parse them with their own schema.
  - **Done when:** tests cover:
    - claiming a pending plan
    - refusing an expired, completed or superseded plan, with a distinct message for each
    - "already running" taking priority in the refusal message
    - superseding the target's other pending plans only after the check passes
    - two interleaved claims, `claimRow` A, then `claimRow` B, then `checkContention` for each: never both succeed, and the loser ends `Superseded`
    - ignoring a stale `Executing` plan
    - a `finish` after cleanup marked the plan `Failed` being a no-op
    - org scoping
    - kind scoping: an `Executing` plan of another kind on the same target doesn't block a claim, and isn't superseded by one
    - cleanup marking stale executions failed and deleting old rows while leaving fresh and executing ones
  - `npm run check` passes.

### Review group 2: D4H builder, executor and plan creation (added beside the old path)

- [x] **3. D4H plan payload schema and builder** — feat(d4h): add D4HSyncPlan payload schema and buildD4HSyncPlan builder
  - **Files:** `src/lib/schemas/d4h-sync-plan.ts`, `src/server/services/d4h-team-sync.ts` (the pure builder section), `src/server/services/d4h-team-sync.test.ts`.
  - **Do:** add these beside the existing `SyncPlan` and `buildSyncPlan`, leaving those untouched until Task 6:
    - **`D4HSyncPlan` schema:**
      - `d4hTeamId`
      - `items`: a discriminated union on `kind: "add" | "update" | "reactivate" | "archive" | "relink" | "metadata"`, each with `itemId`, `personName` where relevant, and what that kind needs to execute (see Decisions)
      - `skipped`, with reasons `missing-email | person-in-rubbish-bin | duplicate-email | membership-in-rubbish-bin`
      - `counts`
    - **`D4HSyncItemOutcome` schema:** `{ itemId, result: "applied" | "skipped-by-user" | "skipped-changed", reason?, skippedFields? }`.
    - **`isD4HSyncPlanEmpty`:** true when there are no items besides a metadata item with no changes.
    - **`buildD4HSyncPlan(input)`:** pure, applying the skip-order, duplicate-email, relink and membership-in-rubbish-bin rules. Extend the inputs as needed:
      - each managed membership's person email (already selected in `fetchD4HSyncInputs`)
      - `Deleted` memberships with their person email
      - `d4hTeamId`
      - the incoming team and org fields
  - **Done when:** unit tests cover:
    - several blank emails giving `missing-email` only
    - duplicate emails, including a case difference, with one of the members already matched by id
    - relink when the old id is gone, and not when it's still present
    - no archival for a relinked membership
    - membership-in-rubbish-bin
    - stable item ids
    - the existing add/update/archive/reactivate cases, ported over
  - `npm run check` passes.

- [x] **4. Per-item executor** — feat(d4h): add executeD4HSyncPlan per-item executor
  - **Files:** `src/server/services/d4h-team-sync.ts`, `src/server/services/d4h-team-sync.test.ts`.
  - **Do:** add `executeD4HSyncPlan(ctx, { planId, skipItemIds, batchId })`:
    - `BatchUpdatePlans.requireById`
    - the guards from Decisions (kind, targetType, team active and linked, `d4hTeamId` match)
    - `claim`
    - parse with `D4HSyncPlan.schema`
    - run the items in order, each with its precondition, using `$transaction([write, logEvent])` per item (`docs/patterns/transactional-writes.md`) and `withBatch(ctx, batchId)`. Move the P2002 take-over fallback into the add item.
    - on success, set `lastSyncedAt` to the plan's `createdAt` and `finish(Completed)`; on an unexpected error, `finish(Failed)` with the partial outcomes, then rethrow
    - return `{ plan, outcomes }`

    The existing `applyD4HSyncPlan` and `runTeamSync` stay until Task 6.

  - **Done when:** service tests with `createMockPrisma` cover:
    - each item kind's applied path
    - each precondition's `skipped-changed` path
    - metadata `before` mismatches leaving those fields alone
    - skipped-by-user items writing nothing
    - a second execute of the same plan giving `CONFLICT`
    - a plan for a relinked D4H team refused
    - an unexpected error leaving the plan `Failed` with partial outcomes and `lastSyncedAt` unchanged
    - the plan storing `logBatchId`
  - `npm run check` passes.

- [x] **5. Plan creation and immediate sync** — feat(d4h): add createD4HSyncPlan and syncImmediately
  - **Files:** `src/server/services/d4h-team-sync.ts`, `src/server/services/d4h-team-sync.test.ts`.
  - **Do:** add these beside the old ones:
    - **`createD4HSyncPlan(ctx, { teamD4H, token })`:** returns `{ status: "in-progress" }` if `findExecuting` finds a plan. Otherwise it fetches the inputs with `fetchD4HSyncInputs`, builds with `buildD4HSyncPlan`, persists with `BatchUpdatePlans.create`, and returns `{ status: "ready", planId, plan }`.
    - **`syncImmediately(ctx, { teamD4H, token, batchId })`:** create, then execute with nothing skipped. Returns the plan for the link toast.
  - **Done when:** tests with a mocked D4H client cover:
    - a ready plan persisted with the right target and `d4hTeamId`
    - `in-progress` while another plan executes
    - `syncImmediately` importing members
  - `npm run check` passes.

### Review group 3: switch over, cron, spec

- [x] **6. Switch router and dialog to persisted plans; remove the token path** — feat(d4h): switch team sync to persisted plans and remove the token path
  - **Files:** `src/trpc/routers/teams-router.ts`, `src/trpc/routers/teams-router.test.ts`, `src/client/teams-effects.ts`, `src/modules/org-admin/components/teams/d4h-link-card.tsx`, `src/server/services/d4h-team-sync.ts`, `src/server/services/d4h-team-sync.test.ts`, `src/lib/schemas/d4h-sync-plan.ts`, `src/lib/errors.ts`, `src/trpc/init.ts`.
  - **Do:**
    - **Router:**
      - Replace `planD4HTeamSync` with the mutation `createD4HTeamSyncPlan({ teamId })`, keeping the same team checks. Its doc comment says why it writes no `logEvent`.
      - Replace `applyD4HTeamSync` with `executeD4HTeamSyncPlan({ planId, skipItemIds })`, which opens the `d4h-team-sync` `LogBatch` and calls `executeD4HSyncPlan`.
      - `linkTeamToD4H` and `createTeamFromD4H` call `syncImmediately`.
      - `unlinkTeamFromD4H` adds `BatchUpdatePlans.supersedePending` to its `$transaction`.
      - Keep procedures in alphabetical order.
    - **Effects:** `executeD4HTeamSyncPlan` gets `teamCaches`, reading `teamId` from the output's plan target. `createD4HTeamSyncPlan` needs no effects.
    - **Dialog data wiring only.** Follow `docs/patterns/mutation-dialog.md`; the dialog stays `?action=`-driven.
      - On open, fire `createD4HTeamSyncPlan` once (guarded with a ref against the StrictMode double-run).
      - List the items read-only, grouped as today plus "Re-link".
      - Show plain text for `in-progress`.
      - Apply sends `{ planId, skipItemIds: [] }`.
      - Drop the `StalePlanError` branch.
      - The link toast counts the new skip reasons.
    - **Delete the old path:** `SyncPlan`, `isSyncPlanEmpty`, `buildSyncPlan`, `computePlanToken`, `applyD4HSyncPlan`, `runTeamSync`, `planD4HSync`, and `StalePlanError` (in `errors.ts` and its mapping at `init.ts:108`). Rename `D4HSyncPlan` to take over the old names only if nothing is ambiguous; otherwise keep the new names.
  - **Done when:** the router tests are rewritten:
    - create, then execute, applies
    - executing another org's plan gives `NOT_FOUND`
    - a second execute gives `CONFLICT`
    - an archived team gives `CONFLICT` or `BAD_REQUEST`, matching the guard
    - create with no D4H token gives `NotConfiguredError`, while executing an existing plan with no token succeeds
    - unlink supersedes a pending plan
    - link and create still import members and return `counts`
  - `grep -rn "planToken\|StalePlanError" src` is empty, and `npm run check` passes.

- [x] **7. Cleanup cron** — feat(d4h): add daily batch-update-plan cleanup cron `mechanical`
  - **Files:** `src/app/api/cron/cleanup-batch-update-plans/route.ts` (new), `src/app/api/cron/cleanup-batch-update-plans/route.test.ts` (new), `src/server/cron/cleanup-batch-update-plans.ts` (new), `vercel.json`.
  - **Do:** copy `src/app/api/cron/purge-rubbish/route.ts` and `src/server/cron/purge-rubbish.ts`, calling `BatchUpdatePlans.runCleanup(prisma, now)` and returning its counts. Schedule it daily, offset from purge-rubbish (`30 14 * * *`).
  - **Done when:** a route test (mocking the `src/server/cron` binding and `serverEnv`) shows a missing or wrong bearer gives 401 and the right one gives 200. `npm run check` passes.

- [x] **8. Spec update** — docs(specs): describe persisted D4H sync plans in the linking spec
  - **Files:** `docs/specs/2026-09-10-d4h-linking.md`.
  - **Do:**
    - Rewrite §6.5, §7.1, §7.3 and §8's sync-dialog paragraph for the persisted-plan flow: create, then execute by id, skip by item id, per-item preconditions and outcomes, one execution per team, the 24-hour expiry and the cleanup cron, and `lastSyncedAt` being the snapshot time.
    - Add to §6.3 that unlink supersedes pending plans.
    - Add the duplicate-email, relink and membership-in-rubbish-bin rows to the §7.2 reconciliation table.
    - Replace the `planToken` line in the "Implementation deltas" list with one pointing to this plan.
  - **Done when:** `grep -n "planToken\|stalePreview" docs/specs/2026-09-10-d4h-linking.md` is empty.

### Review group 4: dialog (`visual` checkpoint)

- [x] **9. Sync dialog: skip checkboxes, in-progress polling, per-item results** — feat(d4h): skippable items, in-progress polling and results in the sync dialog `visual`
  - **Files:** `src/modules/org-admin/components/teams/d4h-link-card.tsx`, `content/help/admin/teams.mdx` (if it describes the sync dialog).
  - **Do:**
    - **Items:** each row gets a checkbox, ticked by default. Apply sends the unticked ids as `skipItemIds`.
    - **In progress:** the `in-progress` state shows "A sync of this team is running", disables Apply, and creates a plan again every 3 seconds while the dialog is open.
    - **While Apply is pending:** the dialog can't be dismissed (`onOpenChange` ignores close, and Cancel is disabled), and reopening doesn't reset the mutation.
    - **On success:** replace the body with a result summary (counts by outcome, and a list of the `skipped-changed` items with their reasons) and a Close button, instead of the toast-and-close.
    - **A `CONFLICT` on execute** shows its message and offers "Refresh preview", which creates a new plan.
    - **Skipped groups:** add "Skipped (email shared by several D4H members)", "Skipped (team membership in the Rubbish bin)" and "Skipped (person already linked to another D4H member)".
    - Update the help card's sync paragraph to match.
  - **Done when:** `npm run check` passes, and at the visual checkpoint the dialog previews, skips an item, applies, and shows results on a D4H-linked test team. An Apply in a second tab of the same plan, or of an older one, gets the conflict message.

## Docs impact

The sync dialog changes: rows can be skipped, there's a result summary after Apply, an in-progress notice, and new "Re-link" and skipped groups. The `content/docs/` guide page covering D4H team linking and syncing needs its sync section and its sync-dialog screenshot redone.

## Out of scope

- Making the whole apply atomic (one interactive transaction). Items still commit one at a time, and a failure leaves the plan `Failed` with partial outcomes. Re-previewing picks up the rest.
- A second plan kind (personnel spreadsheet import, skill-package import #115). The table is generic; their executors aren't built.
- Keeping completed plans as history. The `LogBatch` is the record.
- Scheduled, unattended D4H sync (spec §9, Phase 2).
- #173 (unmounted import dialog).

## Parked

(none yet)

## Review notes — fixed in fix(d4h): address the D4H sync plans review notes

- (Task 2) `batch-update-plans.ts` `ALREADY_RUNNING` says "A sync of this team is already running" in a kind-agnostic service. Make it generic ("Another run of this operation is already in progress") and let the D4H executor/router rephrase it for teams.
- (Task 2) `finish` stamps `completedAt: new Date()`; take an injected `now` like every other lifecycle function, and assert the exact time in tests.
- (Task 2) `payload`/`outcomes` are typed `unknown` and cast to `Prisma.InputJsonValue`; narrow the parameter types to `Prisma.InputJsonValue` so `null`/`undefined` are caught at compile time.
- (Task 2) `runCleanup`'s doc comment: note that a stale-and-expired plan is counted in both `failed` and `deleted`.
- (Task 4) Keep parity with the old path: a sync whose metadata item writes nothing still leaves an entry in its LogBatch. Pair the completion `lastSyncedAt` write with a Team `logEvent` ("Synced with linked D4H team — no metadata changes.") when the metadata item wrote no fields, so a no-op or all-skipped sync doesn't leave an empty LogBatch.
- (Task 4) Close the check-then-write window: put each precondition into the write's `where` (archive `status: "Active"`, reactivate `status: "Archived"`, relink/update the expected `d4hMemberId` and not `Deleted`), catch P2025 and return `skipped-changed`, so a membership binned mid-execute isn't silently restored and its `logEvent` rolls back with it.
- (Task 3) Builder: a D4H member whose `d4hMemberId` is linked to a `Deleted` membership on the team (but whose email now resolves elsewhere) becomes an add that fails `already-linked` every sync. Map `d4hMemberId → Deleted membership` and skip those as `membership-in-rubbish-bin` right after `missing-email`. Add a test.
- (Task 4) Missing `skipped-changed` tests: reactivate and archive `d4h-member-changed`, relink `membership-in-rubbish-bin`, `membership-missing` for one kind, and the add's P2002 take-over fallback on the new path.
- (Task 3) `D4HSyncItemOutcome.reason` → a `z.enum` of the reasons the executor produces, with `changed(reason)` typed against it (Task 9's label map then gets an exhaustiveness check).
- (Task 4) `isLinkedOnTeam`: replace the cross-org `findMany` + JS filter with a scoped `findFirst` on `teamMembership: { teamId, organizationId }`.
- (Task 4) If `finish(Failed)` throws, it must not replace the original error: swallow/log its failure and always rethrow the original.
- (Task 6) `src/server/services/teams.ts:241`: `createMembership`'s doc comment still refers to the deleted `adoptExistingMembership`; update it.
- (Task 6) `executeD4HTeamSyncPlan` opens its LogBatch before the executor's guards/claim, so a refused execute leaves an empty batch. Open the batch lazily (after `claim` succeeds), e.g. by passing a batch factory to the executor.
- (Task 6) `syncImmediately` throws `ConflictError` on `in-progress` after the link/create transaction has committed (unlink → relink within 10 min while an old run is executing). Return the `in-progress` case and have link/create report "Linked; a sync is already running — sync again shortly" instead of a CONFLICT error.
- (Task 6) The link toast reads planned `counts`; count `outcomes` with `result === "applied"` per kind instead.
- (Task 6) `executeD4HTeamSyncPlan` and the executor both run `requireById` + the team lookup; fold this into the lazy-batch change so the router stops duplicating them.
- (Task 6) `teams-effects.ts`: move `executeD4HTeamSyncPlan` next to the other D4H effects.
- (Task 8) Spec §10 checklist rows 6 and 9 still name `planD4HTeamSync`/`applyD4HTeamSync`/`buildSyncPlan`; rename them to the new names.
- (Task 9) Close mid-apply, let it settle, reopen: the previous result view can flash for a frame. Reset `execute` in `onSettled` when the dialog is closed.
- (Task 9) If the component unmounts while open, `openRef` stays true and the success toast is skipped; clear it in an unmount cleanup.
- (Task 9) Checkbox lists: use the repo's `Field orientation="horizontal"` + `Checkbox id` + `FieldLabel htmlFor` pattern (`change-session-personnel.tsx`), and label each group (`fieldset`/legend or `aria-labelledby`).
- (Task 9) Copy: "Team metadata: left Name, Timezone alone, edited since the preview" → "<name>: <fields> not changed (edited in AVUT since the preview)"; show "untick any you don't want…" only when there are tickable items, otherwise a neutral description.
- (Task 9) `content/help/admin/teams.mdx`: rewrap the new sync paragraph to ~80 columns like the rest of the file.
