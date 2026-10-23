# I3 Return Items, D4H task queue and equipment item page

**Date:** 2026-10-22
**Issues:** [#443](https://github.com/redcloud-nz/avut/issues/443) (Return Items + D4H task queue + up-front permission checks), [#25](https://github.com/redcloud-nz/avut/issues/25) (equipment item view/edit page). Promoted from redcloud-nz/avut-ideas#28, whose comments hold the live D4H findings.
**Branch:** `feat/i3-return-items`, worktree `.claude/worktrees/i3-return-items` (dev server on its `.dev-port`, 3107)
**DB:** adds a migration (Task 5). Run `npm run db:branch i3-return-items` before that task's `migrate dev`. It needs every connection to `avut` closed, including the user's 3000 server and Prisma Studio.
**D4H:** reads and writes live D4H equipment through the user's personal token. Only the user's account has one, so D4H-backed pages can be checked only on the user's own session.
**Written against:** integration @ d87c39f0

## Decisions

- **What D4H allows** (probed 2026-10-22, see avut-ideas#28):
  - `PATCH /v3/team/{teamId}/equipment/{itemId}` accepts only `status`, `isCritical`, `isMonitor`, `barcode`, `notes`, `updateNotes` and `customFieldValues`, and rejects everything else with a 400.
  - The `status` values are `OPERATIONAL | UNSERVICEABLE | LOST | WISHLIST | INACTIVE`. D4H's UI labels `INACTIVE` "Non Operational".
  - There is no retire or move endpoint.
  - A retired item (retired by hand in D4H's web app) still GETs with a 200, `status: "RETIRED"`, `dateRetired` and `retiredReason.id`, and drops out of `only_current`.
  - `INACTIVE` items stay in `only_current`.
- **An item's `location` never reaches the client.** It expands to the member's full D4H record (address, phones, emergency contacts, iCal secret). Every item schema is a `z.object` without `location`, so parsing strips it. A test asserts that.
- **No D4H token.** Every new procedure goes through `getConfiguredD4HAccessToken`, which throws `NotConfiguredError`, which reaches the client as `PRECONDITION_FAILED`.
  - The new pages behave as the existing I3 browse pages do: the error boundary shows the "add a D4H token in User Settings" message.
  - The item page's `generateMetadata` catches `PRECONDITION_FAILED` and falls back to the title `Item #<item_id>`, so a missing token never becomes a stripped generic error.
  - The forms surface the same message on submit.
  - Tasks 4 and 7 test the no-token case.
- **The I3 item page is separate from `d4h-views/equipment/items/[item_id]`.** That page is a read-only TanStack DB view in another module. I3's page does a live GET, edits, and shows tasks. Don't consolidate them in this branch.
- **Return** = for each item: GET it, then PATCH `status: "INACTIVE"` and `updateNotes`. Then queue a retire task.
  - The processor checks the submitted item ids against the "Returned by" member's current items (a `member_id`-filtered equipment list, as `listMemberEquipment` uses), because `location` is stripped from the item schema.
  - `updateNotes` is `Returned via AVUT, received by <submitter name>.`, followed by ` <comments>` when there are comments. It lands on the status change's history entry.
  - The item's `notes` aren't touched (decided with the user 2026-10-23). D4H's history already records when the item changed and who held it, so a notes line would only duplicate it.
  - The retire task's payload is `{ reason: "Returned To Cache" }`. It's text shown to whoever applies it. AVUT doesn't look up D4H's retired-reason ids.
- **D4H task queue.** A new `D4HTask` table holds changes the API can't make, to be applied by hand in D4H.
  - v1 has one kind, `Retire`, on resource type `Equipment`.
  - Status is `Open`, `Done` or `Dismissed`. `applyMethod` is `Manual` or `Api`; v1 only writes `Manual`.
  - The table records `requestedBy`/`requestedAt` and `appliedBy`/`appliedAt`, so approve-later can be added without reshaping it.
  - It stores `itemLabel` (e.g. `#1234 Helmet`), so the tasks list renders without a D4H call per task.
  - It links `formInstanceId` (SetNull) back to the Return that queued it.
  - **Check** re-fetches the item with the viewer's token and marks the task `Done` when `status === "RETIRED"`. Otherwise it reports "not retired yet".
    - It records `appliedById`/`appliedAt`. For a `Manual` task, that means whoever confirmed the change had been applied, which can't be told apart from whoever did it in D4H. Document that on the model.
  - **Dismiss** closes the task without applying it, for an item already handled or deleted in D4H.
    - It leaves `applied*` null. The log entry records who dismissed it.
    - A deleted item GETs a 404, so Check reports that and suggests Dismiss.
- **Permissions:**
  - New `i3Item: ["update"]` action, granted to `i3-editor` and `i3-admin`. It gates the item edit dialog, the D4H tasks page, and Check/Dismiss. `inspect` stays reserved for the Inspect workflow, and its sidebar entry is unchanged.
  - D4H's own permission on the item's team is also required. It's read from whoami, uncached for every write (as the Issue processor does today) and cached for display.
    - Issue: `Equipment.CREATE`
    - Return and item edit: `Equipment.UPDATE`
    - Seeing, checking or dismissing a retire task: `Equipment.RETIRE`
  - One helper, `requireD4HTeamPermission`, throws `ForbiddenError` with a message naming the team and permission.
- **Issue and Return refuse up front.** The permission check is the first stage after the token check, and throws. Issue's `conditionalStage` and its "insufficient permissions" email branch go away. In the UI, both forms show the problem as soon as a recipient is chosen and disable Submit.
- **Notification email.** Return sends a new `I3ReturnItemsNotificationEmail` to the same placeholder sink Issue uses (`delivered+i3-notify@resend.dev`). Who should really receive it belongs to the Notification channels brainstorm.
- **Audit log.**
  - `D4HTask` is a new log object type, attributed to the `i3` module. Creating, checking and dismissing a task each log an entry.
  - D4H item edits log `Update` on a new `D4HEquipmentItem` object type (objectId = the D4H item id as a string), with `changes: diffObject(before, after)` (`src/lib/diff.ts`) over the PATCHable fields.
  - A Return opens a `LogBatch` with a new `i3-return-items` operation, using `createLogBatch({ operationKey, userId, actorLabel: formatActorLabel(...), description }, ctx.prisma)` as `teams-router.ts` does.
    - It's bound once with `withBatch(ctx, batch.id)`, and that context is what the item log and `D4HTasks.createRetireTask` receive.
    - The batch opens lazily, on the first successful PATCH, so a Return where every item fails leaves no orphan batch.
  - D4H writes can't join a Prisma `$transaction`. The D4H call happens first, and the log/task rows are written with a plain `await` after it succeeds. That's the documented non-Prisma exception in `docs/patterns/transactional-writes.md`.
- **Form pipeline output.** `FormProcessingPipeline.execute` returns only stage results and throws away the accumulated output.
  - Add `executeWithOutput`, which returns `{ results, output }`. `execute` keeps its signature, so Issue is unchanged.
  - Return uses `executeWithOutput`, so `submitReturnItemsForm` can return `{ returned, failures }` for the toast.
- **Stage errors already keep their domain type.** `submitIssueItemsForm` wraps the first stage error as the `cause` of an `INTERNAL_SERVER_ERROR` `TRPCError`, and `mapDomainErrors` (`src/trpc/init.ts`) unwraps a domain `cause`. So a `ForbiddenError` from a stage reaches the client as `FORBIDDEN`, and `NotConfiguredError` as `PRECONDITION_FAILED`. No rethrow logic is needed. A test pins it.
- **D4H web-app links.** `https://{team.subdomain}.team-manager.{region}.d4h.com/team/equipment/edit/{itemId}`.
  - `subdomain` is added to `D4HTeamDetail` (`fetchD4HTeamDetailCached` already fetches the endpoint that returns it).
  - The region's host goes on `D4HServerInfo` as `teamManagerHost` (e.g. `team-manager.ap.d4h.com`).
- **Item page route:** `/orgs/[slug]/i3/teams/[team_id]/equipment-items/[item_id]`. It follows `docs/patterns/detail-page-data-fetching.md`. The existing I3 team pages are client components using `useSuspenseQuery`. The new page uses the pattern doc's split, with breadcrumbs I3 › <team> › Item #<ref>.
- **Returned badge** (decided with the user 2026-10-23, revising the earlier "INACTIVE = Returned"):
  - An item shows "Returned" while it has an **open Retire task**, in the browse pages and on the item page. It isn't hidden.
  - `INACTIVE` keeps D4H's label "Non Operational", so an item taken out of service for repair isn't mistaken for a return.
  - An item that went INACTIVE without its task being queued (a partial failure) can be returned again, which only re-queues the task.
  - The browse pages get each team's returned item ids from `d4hTasks.listReturnedItemIds({ teamId })` (Task 7), one query per page.
    - `listReturnedItemIds` is gated on `d4hEquipment: ["view"]`, the same permission as the equipment data it annotates, so owner/admin/member see the badge without any `i3Item` action. It exposes only item ids.
- **Kind-page team filter (side fix, in-branch).** `equipment-kinds/page.tsx` and `equipment-kinds/[kind_id]/page.tsx` fan out `listMemberEquipment` over members of every accessible team. Filter to `member.owner.id === teamId`, as `members/page.tsx` does.

## Tasks

### Review group A: D4H foundations and Issue

- [x] **Task 1: `i3Item: ["update"]` and `requireD4HTeamPermission`**
  - **Files:** `src/lib/permissions.ts`, `src/server/d4h-permissions.ts` (new), `src/server/d4h-permissions.test.ts` (new), `src/lib/d4h-permissions.ts` (new), `src/lib/d4h-permissions.test.ts` (new)
  - **Do:**
    - Add `"update"` to `i3Item` in the statement, and to `i3-editor` and `i3-admin`.
    - Add `requireD4HTeamPermission(token: D4HAccessToken_ServerOnly, teamId: number, resource: "Equipment", action: "CREATE" | "UPDATE" | "RETIRE")`.
      - It calls the uncached `fetchD4HWhoami` and finds the membership whose `owner.id === teamId`.
      - It throws `ForbiddenError` (`src/lib/errors.ts`) when `permissions?.[resource]?.[action] !== true`, with a message like `You need D4H's Equipment UPDATE permission on <team title> to do this.` Take the team title from the whoami membership if it's there, otherwise use `team <id>`.
    - Add `hasD4HTeamPermission(permissions: D4HTeamPermissions | undefined, resource, action): boolean` in `src/lib/d4h-permissions.ts` (new, shared by client and server). It does the same read on an already-loaded permissions record, so the UI can use `listAccessibleTeams`' `permissions`.
    - Tests mock `@/server/d4h-api/client` as `src/forms/i3-issue-items/processor.test.ts` does. Cover: allowed, permission false, permission missing, no membership in the team.
  - **Done when:** the tests pass and `npm run check` is clean.

- [x] **Task 2: D4H equipment item schemas, fetch/patch helpers and web-app URL**
  - **Files:** `src/lib/schemas/d4h/equipment-item.ts`, `src/lib/schemas/d4h/team.ts`, `src/lib/d4h-servers.ts`, `src/server/d4h-api/equipment.ts` (new), `src/server/d4h-api/equipment.test.ts` (new)
  - **Do:**
    - Add `D4HEquipmentItemDetail` = `D4HEquipmentItem.schema.extend({ isCritical: z.boolean(), isMonitor: z.boolean(), barcode: z.string().nullable(), retiredReason: z.object({ id: z.number().nullable(), resourceType: z.literal("EquipmentRetiredReason") }).nullable().optional() })`, and extend `kind` with `category: { title }` so the page can show the category name. No `location`.
      - In `schema.d.ts` the GET response is typed `unknown`. These names come from its JSDoc `@example` (~line 17769) and the 2026-10-22 live probe, so Zod is the only guard. Keep the new fields lenient (`.optional()` where the example shows them nullable).
    - Add the `D4HEquipmentStatus` enum of PATCHable values: `OPERATIONAL, UNSERVICEABLE, LOST, WISHLIST, INACTIVE`.
    - Add `D4HEquipmentItemUpdate` = `{ status?, isCritical?, isMonitor?, barcode?: string, notes?: string, updateNotes?: string }`. Clearing a barcode sends `""`.
    - Add `subdomain: z.string()` to `D4HTeamDetail`.
    - Add `teamManagerHost` to each `D4HServerInfo` (`team-manager.ap.d4h.com`, etc.), and `d4hEquipmentItemUrl(serverCode, subdomain, itemId)`, which returns the web-app edit URL.
    - Add `src/server/d4h-api/equipment.ts` (`import "server-only"`):
      - `fetchD4HEquipmentItem(token, teamId, itemId): Promise<D4HEquipmentItemDetail | null>`. It returns `null` on a 404, throws on any other non-ok response (check `response.ok`, not `error`; see `listEquipmentItems`), and parses with the detail schema.
      - `patchD4HEquipmentItem(token, teamId, itemId, update: D4HEquipmentItemUpdate)`. It sends only the keys that are set, and throws with D4H's status and body on a non-ok response.
        - The generated PATCH body type lacks `notes`, so cast the body in this one place, with a comment citing the live probe. `equipment.ts` needs its own cast helper, like `client.ts`'s private `d4hGetWithUntypedPath`.
      - Both are uncached.
    - Tests:
      - Parsing a fixture that includes a `location` member object leaves no `location` key.
      - A 404 returns null.
      - PATCH sends only the provided keys.
  - **Done when:** the tests pass and `npm run check` is clean.

- [x] **Task 3: Issue refuses up front**
  - **Files:** `src/forms/i3-issue-items/processor.ts`, `src/forms/i3-issue-items/processor.test.ts`, `src/emails/i3-issue-items-notification.tsx`, `src/server/form-processor.ts`, `src/server/form-processor.test.ts`, `src/trpc/routers/i3-router.test.ts`
  - **Do:**
    - Replace the `CheckPermissions` stage with a call to `requireD4HTeamPermission(accessToken, recipient.teamId, "Equipment", "CREATE")`, placed straight after `CheckD4HAccessToken` (before `ProcessItems`).
    - Make `CreateEquipmentInD4H` a plain `stage`.
    - Drop the `?? { reason: "insufficient permissions" }` fallback in `NotifyAdmin`, and any email copy that only exists for the skipped case.
    - Add `executeWithOutput` to `FormProcessingPipeline` (`src/server/form-processor.ts`). It returns `{ results, output }`, where `output` is the accumulated stage output. `execute` keeps its signature. Add a test in `src/server/form-processor.test.ts` (create it if it's missing).
    - Update the processor tests: with no permission, no POST is made, no email is sent, and the error is surfaced. Keep the existing partial-failure tests.
    - Add an `i3-router.test.ts` case pinning that a stage `ForbiddenError` reaches the client as `FORBIDDEN` with its message, through the existing wrap (see Decisions). Mock the processor module.
  - **Done when:** the tests pass and `npm run check` is clean.

- [x] **Task 4: `d4hApi.getEquipmentItem` and `d4hApi.updateEquipmentItem`**
  - **Files:** `src/trpc/routers/d4h-api-router.ts`, `src/trpc/routers/d4h-api-router.test.ts` (new), `src/lib/schemas/log-entry.ts`, `src/client/d4h-api-effects.ts` (new, `createEffects<"d4hApi">()`)
  - **Do:**
    - `getEquipmentItem: organizationProcedure({ d4hEquipment: ["view"] })`, input `{ teamId: z.number(), itemId: z.number() }`.
      - It returns `{ item: D4HEquipmentItemDetail, d4hUrl: string }`.
      - It fetches the item through Task 2's helper. A null result throws `NotFoundError`.
      - It builds `d4hUrl` from `fetchD4HTeamDetailCached(...).subdomain` and the token's `serverCode`.
      - If `item.owner.id !== teamId`, it throws `NotFoundError`.
    - `updateEquipmentItem: organizationProcedure({ i3Item: ["update"] })`, input `{ teamId, itemId, ...D4HEquipmentItemUpdate }` with at least one field set.
      - It calls `requireD4HTeamPermission(..., "UPDATE")`, then GETs the item (`NotFoundError` if it's null or `item.owner.id !== teamId`), then PATCHes and re-fetches.
      - Then `await ctx.logEvent({ action: "Update", objectType: "D4HEquipmentItem", objectId: String(itemId), changes: diffObject(pick(before), pick(after)) })`, over the PATCHable fields.
      - It returns the re-fetched item.
    - Put the new `get*` procedure before the `list*` ones and `update*` at the end. The top of the file is already out of order; leave it alone.
    - Add `D4HEquipmentItem` to `logObjectTypeValues` and to `moduleByObjectType` (`"i3"`).
    - Declare the `updateEquipmentItem` effects in the new `src/client/d4h-api-effects.ts` (`src/trpc/mutation-effector.tsx`):
      - `write(trpc.d4hApi.getEquipmentItem.queryKey({...}), (old) => old && { ...old, item: updated })`
      - invalidate `listMemberEquipment` and `listEquipmentItems` (which feeds d4h-views)
    - Tests follow `.claude/rules/testing.md` and mock the D4H modules:
      - no token configured → `PRECONDITION_FAILED`
      - get returns the item and URL
      - get on a 404 → `NOT_FOUND`
      - get on another team's item → `NOT_FOUND`
      - update without `i3Item: ["update"]` → `FORBIDDEN`
      - update without D4H UPDATE → `FORBIDDEN`, with no PATCH
      - update logs an entry
  - **Done when:** the tests pass and `npm run check` is clean.

### Review group B: D4H task queue

- [x] **Task 5: `D4HTask` model and migration**
  - **Files:** `prisma/schema.prisma`, `prisma/migrations/<timestamp>_d4h_tasks/migration.sql`, `src/lib/schemas/d4h-task.ts` (new), `src/lib/schemas/log-entry.ts`
  - **Do:**
    - First run `npm run db:branch i3-return-items`, stopping the worktree's server and asking the user to stop 3000 and Prisma Studio. Then ask for permission before `npm run prisma migrate dev --name d4h_tasks`.
    - Model `D4HTask` (`@@map("d4h_tasks")`), following `OrganizationNote`'s style:
      - `id`
      - `organizationId`, a relation with Cascade
      - `d4hTeamId Int`
      - `resourceType String` (`"Equipment"`)
      - `resourceId Int`
      - `itemLabel String`
      - `kind String` (`"Retire"`)
      - `payload Json @default("{}")`
      - `status String @default("Open")`
      - `applyMethod String @default("Manual")`
      - `requestedById String?` and `appliedById String?`, both `User` relations with SetNull
      - `requestedAt DateTime @default(now())`
      - `appliedAt DateTime?`
      - `formInstanceId String?`, a relation to `FormInstance` with SetNull
      - `createdAt`, `updatedAt`
      - `@@index([organizationId, status])`
      - `@@index([organizationId, d4hTeamId, resourceId])`
      - Back-relations on `Organization`, `User` (two named relations) and `FormInstance`.
    - Add `src/lib/schemas/d4h-task.ts`:
      - `D4HTaskId` (the `I3TemplateId` pattern)
      - `D4HTaskStatus` and `D4HTaskKind` enums
      - `D4HTaskPayload` (a discriminated union on `kind`; v1 is just `Retire: { reason: string }`)
      - `D4HTask.schema` plus `fromRecord`
    - Add `D4HTask` to `logObjectTypeValues` and `moduleByObjectType` (`"i3"`).
  - **Done when:** `migrate dev` has applied to `avut_i3-return-items`, `npx prisma validate` passes, and `npm run check` is clean.

- [x] **Task 6: `d4h-tasks` service**
  - **Files:** `src/server/services/d4h-tasks.ts` (new), `src/server/services/d4h-tasks.test.ts` (new), `src/lib/operations.ts`
  - **Do:** follow `src/server/services/CLAUDE.md` and `i3-templates.ts`. It takes `OrgServiceContext`, throws domain errors, and pairs each write with `ctx.logEvent` in `$transaction`.
    - `createRetireTask(ctx, { d4hTeamId, itemId, itemLabel, reason, formInstanceId? })` logs `Create`.
    - `listOpen(ctx, { d4hTeamIds: number[] })` returns open tasks, oldest first.
    - `listForItem(ctx, { d4hTeamId, itemId })` returns open tasks for one item.
    - `requireById(ctx, id)`
    - `markApplied(ctx, id)` sets `Done`, `appliedById = ctx.userId` and `appliedAt`, and logs `Update`. It throws `ConflictError` unless the task is `Open`.
    - `dismiss(ctx, id)` sets `Dismissed`, leaves `applied*` null, logs `Update`, and has the same `Open` guard.
    - `hasOpenRetireTask(ctx, { d4hTeamId, itemId })`, used by Task 8.
    - Add the `i3-return-items` operation to `src/lib/operations.ts`, used in Task 8.
    - Tests use prisma-mock and cover each function, including both guards.
  - **Done when:** the tests pass and `npm run check` is clean.

- [x] **Task 7: `d4hTasks` router**
  - **Files:** `src/trpc/routers/d4h-tasks-router.ts` (new), `src/trpc/routers/d4h-tasks-router.test.ts` (new), `src/trpc/routers/_app.ts`, `src/client/d4h-tasks-effects.ts` (new)
  - **Do:** every procedure uses `organizationProcedure({ i3Item: ["update"] })`, except `listReturnedItemIds`.
    - `listReturnedItemIds({ teamId })`, gated on `organizationProcedure({ d4hEquipment: ["view"] })` (the browse and item pages need only that, and it exposes nothing beyond item ids), returns the `resourceId`s of that team's open Retire tasks for the Returned badge. It needs no D4H call and no token. Add the backing `Service.listOpenRetireItemIds(ctx, { d4hTeamId })` to Task 6's service.
    - `listOpenTasks` reads the token's teams with `fetchD4HWhoamiCached` and keeps the team ids where `hasD4HTeamPermission(..., "Equipment", "RETIRE")`. It returns `Service.listOpen`, with each task's `d4hUrl` (Task 2) and team title.
    - `listItemTasks({ teamId, itemId })` returns `Service.listForItem`, or an empty list when the viewer lacks `Equipment.RETIRE` on `teamId` (cached whoami).
    - `checkTask({ taskId })`:
      1. `requireById`.
      2. `requireD4HTeamPermission(..., "RETIRE")`.
      3. `fetchD4HEquipmentItem`.
         - When the item is null, return `{ result: "missing" }`.
         - When `status === "RETIRED"`, call `markApplied` and return `{ result: "applied", task }`.
         - Otherwise return `{ result: "pending", status }`.
    - `dismissTask({ taskId })` checks the same D4H permission, then calls `dismiss`.
    - Effects: `checkTask` and `dismissTask` invalidate `listOpenTasks`, `listItemTasks` and `listReturnedItemIds`.
    - Tests:
      - no token configured → `PRECONDITION_FAILED`
      - the list filter by RETIRE, including `listItemTasks` without RETIRE
      - each check result
      - FORBIDDEN without the AVUT or the D4H permission
      - dismiss
  - **Done when:** the tests pass and `npm run check` is clean.

### Review group C: Return data layer

- [x] **Task 8: Return form schema, processor and email**
  - **Files:** `src/lib/forms.ts`, `src/forms/i3-return-items/schema.ts` (new), `src/forms/i3-return-items/processor.ts` (new), `src/forms/i3-return-items/processor.test.ts` (new), `src/emails/i3-return-items-notification.tsx` (new)
  - **Do:**
    - Add `I3ReturnItemsForm = { formKey: "i3-return", ... }` to `forms`.
    - Schema `I3ReturnItemsFormData`:
      - `recipient { id, teamId, name }`, refined to `id > 0` (the person returning, called "Returned by" in the UI)
      - `items: nonempty array of { itemId: number, ref: string, kindTitle: string }`
      - `comments: string`
    - Processor (mirrors `I3IssueItemsFormProcessor`):
      1. `CheckD4HAccessToken`.
      2. `CheckPermissions` (`requireD4HTeamPermission(..., recipient.teamId, "Equipment", "UPDATE")`).
      3. `ReturnItems`:
         - Fetch the recipient's current item ids once (`only_current`, `member_id`).
         - For each item:
           - `fetchD4HEquipmentItem`. Skip with a failure if it's null, owned by another team, not among the recipient's current items, `RETIRED`, or already has an open retire task.
           - PATCH `INACTIVE`, the appended notes and `updateNotes` (see Decisions). Format the date in the team's timezone from `fetchD4HTeamDetailCached`.
           - On the first successful PATCH, open the `LogBatch` lazily (see Decisions) and bind it with `withBatch`.
           - Log the item `Update` (`diffObject` on status and notes) through the batch context.
           - `D4HTasks.createRetireTask` with the batch context, `formInstanceId` and `itemLabel` `#<ref> <kindTitle>`.
         - Keep going past failures and collect them, as Issue does. The return value is `{ returned: n, failures: string[] }`.
      4. `NotifyAdmin` sends the new email to the same sink as Issue, with the returned and failed items.
    - The email follows `i3-issue-items-notification.tsx`'s layout and preview-props style.
    - Tests:
      - the happy path (PATCH body, task created, email)
      - no permission (nothing patched)
      - a missing item, an item not held by the recipient, and an item with an open retire task (failures, the rest continue)
      - all items failing opens no batch
      - notes appended to the existing notes, not replaced
  - **Done when:** the tests pass and `npm run check` is clean.

- [x] **Task 9: `i3.submitReturnItemsForm`**
  - **Files:** `src/trpc/routers/i3-router.ts`, `src/trpc/routers/i3-router.test.ts`, `src/client/i3-effects.ts`
  - **Do:**
    - Add `submitReturnItemsForm: organizationProcedure({ i3Item: ["return"] })` after `submitIssueItemsForm`, with the same shape: save the instance, then `executeWithOutput`, then wrap the first stage error the same way.
    - It has `.output(z.object({ returned: z.number(), failures: z.array(z.string()) }))`, taken from the `ReturnItems` output.
    - Effects in `i3Effects.submitReturnItemsForm`:
      - invalidate `listMemberEquipment`, `d4hTasks.listOpenTasks`, `d4hTasks.listItemTasks`, `d4hTasks.listReturnedItemIds` and the Return drafts list
      - `meta.navigates`, since the page pushes back to the list on success
    - Tests:
      - FORBIDDEN without `i3Item: ["return"]`
      - the processor is invoked with the saved data, and its counts are returned (mock the processor module)
  - **Done when:** the tests pass and `npm run check` is clean.

### Review group D: item page and browse pages (visual checkpoint at the end)

- [x] **Task 10: equipment item detail page** `visual`
  - **Files:** `src/app/(wrapper)/(authenticated)/orgs/[slug]/i3/teams/[team_id]/equipment-items/[item_id]/page.tsx` (new), `src/modules/i3/components/equipment-item/equipment-item-content.tsx` (new), `src/modules/i3/components/equipment-item/item-tasks-card.tsx` (new), `src/modules/i3/components/returned-badge.tsx` (new)
  - **Do:**
    - Follow `docs/patterns/detail-page-data-fetching.md`: `page.tsx` with `generateMetadata` (title `Item #<ref>`) and a prefetch, then a client content component with `Saratoga.Columns`.
    - `generateMetadata` catches `PRECONDITION_FAILED` (no token) and uses `Item #<item_id>` (see Decisions).
    - Main column: an "Item Information" card (description list) showing ref, kind, category, brand, model, serial, D4H status (labelled with D4H's names, e.g. INACTIVE → "Non Operational"), critical, monitor, barcode, the dates, and notes (preserving line breaks).
    - Header actions: an "Open in D4H" external link (`d4hUrl`, `target="_blank" rel="noreferrer"`).
    - Secondary column: `ItemTasksCard`, shown inside `<Protect permissions={{ i3Item: ["update"] }}>`. It lists the item's open tasks with Check and Dismiss buttons, reports each check result with a toast, and says "No open D4H tasks" when there are none.
    - `ReturnedBadge` renders when the item is in `listReturnedItemIds({ teamId })`. D4H status shows D4H's own label beside it.
    - Breadcrumbs: I3 › <team title> › Item #<ref>.
    - Run `npx next typegen`.
  - **Done when:** the page renders for a real item on the user's team, and `npm run check` is clean.

- [x] **Task 11: edit item dialog** `visual`
  - **Files:** `src/modules/i3/components/equipment-item/update-equipment-item.tsx` (new), `src/modules/i3/components/equipment-item/equipment-item-content.tsx`
  - **Do:**
    - Follow `docs/patterns/mutation-dialog.md` (`?action=update` through nuqs, a controlled `…_Dialog`).
    - Fields: status (Select of the five PATCHable values, with D4H labels), critical (Switch), monitor (Switch), barcode, notes (Textarea) and an optional update note.
    - Send only the changed fields.
    - Gate it with `<Protect permissions={{ i3Item: ["update"] }} render={...}>`, and also disable it with an explanatory tooltip when `hasD4HTeamPermission(team.permissions, "Equipment", "UPDATE")` is false. The team comes from `listAccessibleTeams`.
    - Check the gating against `docs/patterns/protect-permission-gating.md`.
  - **Done when:** editing updates D4H, the page shows the change, and `npm run check` is clean.

- [x] **Task 12: browse pages link to items, show Returned, filter by team** `visual` `mechanical`
  - **Files:** the `i3/teams/[team_id]/` pages `equipment-kinds/page.tsx`, `equipment-kinds/[kind_id]/page.tsx` and `members/[member_id]/page.tsx`
  - **Do:**
    - Link each item's ref cell to the item page with `route("/orgs/[slug]/i3/teams/[team_id]/equipment-items/[item_id]", ...)`.
    - Add `ReturnedBadge` next to the ref for items in `d4hTasks.listReturnedItemIds({ teamId })` (one query per page).
    - In both equipment-kinds pages, filter `members` to `member.owner.id === teamId` before the `listMemberEquipment` fan-out, as `members/page.tsx` does.
  - **Done when:** the links open the item page, the kind pages fetch only the current team's members (one `listMemberEquipment` per team member in the network panel), and `npm run check` is clean.

### Review group E: tasks page and forms (visual checkpoint at the end)

- [x] **Task 13: D4H tasks page and sidebar entry** `visual`
  - **Files:** `src/app/(wrapper)/(authenticated)/orgs/[slug]/i3/d4h-tasks/page.tsx` (new), `src/modules/i3/components/d4h-tasks-list.tsx` (new), `src/modules/i3/components/sidebar-menu.tsx`
  - **Do:**
    - A list page (Saratoga) of `listOpenTasks`, grouped by team. Each row shows the item label linked to the item page, the kind and reason ("Retire — Returned To Cache"), who requested it and when, Open in D4H, Check and Dismiss.
    - Empty state: "No open D4H tasks".
    - Add a "D4H Tasks" sidebar entry inside `<Protect permissions={{ i3Item: ["update"] }}>`.
    - Gate Check and Dismiss per `docs/patterns/protect-permission-gating.md`.
    - The rows are compact enough to use on a phone, although the expected use is on a computer.
    - Run `npx next typegen`.
  - **Done when:** the page lists a queued task, Check closes it once it's retired in D4H, and `npm run check` is clean.

- [x] **Task 14: extract shared form pieces from the Issue page** `mechanical`
  - **Files:** `src/modules/i3/components/form-shared.tsx` (new), `src/app/(wrapper)/(authenticated)/orgs/[slug]/i3/forms/issue-items/[instance_id]/page.tsx`, `src/client/i3-effects.ts`
  - **Do:**
    - Move `UserNameFieldValue` and the debounced-save/delete scaffolding (the `useDebouncer` auto-save and `SaveStatusIndicator` wiring) into `form-shared.tsx`, parameterised by `formKey`.
    - The Issue page uses them, and uses `I3IssueItemsForm.formKey` instead of the literal `"i3-issue"`.
    - Move the Issue submit's hand-written `invalidateQueries` in `onSuccess` onto `i3Effects.submitIssueItemsForm` (the call site passes `meta: { effects, navigates: true }`, since `navigates` is a call-site flag, not part of an effects entry), per `src/trpc/mutation-effector.tsx`.
    - No behaviour change.
  - **Done when:** the Issue page works as before (drafts autosave, submit returns to the list), and `npm run check` is clean.

- [x] **Task 15: Return Items form pages** `visual`
  - **Files:**
    - `src/app/(wrapper)/(authenticated)/orgs/[slug]/i3/forms/return-items/page.tsx` (replace the stub)
    - `src/app/(wrapper)/(authenticated)/orgs/[slug]/i3/forms/return-items/[instance_id]/page.tsx` (new)
    - `src/modules/i3/components/return-items-form-list.tsx` (new)
  - **Do:**
    - Run `npx next typegen` after adding the page.
    - Mirror Issue's list page and draft flow (`listDraftFormInstances` and `newFormInstanceMutation` with the `i3-return` key).
    - The instance page has:
      - "Returned by", using `D4HTeamMemberSelect`
      - a checklist of that person's items from `listMemberEquipment`, excluding those in `listReturnedItemIds`, with ref, kind and serial
      - comments
      - "Received by", showing the current user
      - Submit, calling `trpc.i3.submitReturnItemsForm` with `meta: { effects: i3Effects.submitReturnItemsForm, navigates: true }`
    - When the chosen person's team lacks `Equipment.UPDATE` (`hasD4HTeamPermission` on `listAccessibleTeams`), show an inline alert and disable Submit.
    - After submit, show a toast that names the number of items returned and any failures, then go back to the list.
  - **Done when:** returning one item on the user's team makes it INACTIVE with the note in D4H and queues a retire task, and `npm run check` is clean.

- [x] **Task 16: Issue form permission alert, and help card** `visual` `mechanical`
  - **Files:** `src/app/(wrapper)/(authenticated)/orgs/[slug]/i3/forms/issue-items/[instance_id]/page.tsx`, `content/help/i3.mdx` (plus any new card `content/README.md` calls for)
  - **Do:**
    - On the Issue page, use the same inline alert and disabled Submit as Return, but for `Equipment.CREATE`.
    - Update the I3 help card: Return Items is built, plus a line each on the D4H tasks page and the item page.
    - Add a card and a `<HelpButton>` only where `content/README.md` says a screen needs its own card.
  - **Done when:** the alert shows for a team without CREATE, and `npm run check` is clean.

## Docs impact

I3 guide: new Return Items, D4H tasks and item page (view/edit/Open in D4H) sections in `content/docs/i3`, Issue's new permission refusal, and new screenshots of the Return form, tasks list and item page.

## Out of scope

- Approve-later, and tasks created by people without the D4H permission (the table leaves room for both).
- Inspect (`/i3/inspect` stays a stub).
- Field-change tasks (brand/model/serial/kind/dates). v1 only handles retire tasks.
- #26 (fan-out latency), and #23 (linked teams).
- Who receives the I3 notification emails (Notification channels brainstorm).
- Looking up D4H retired-reason ids. The reason is free text in the task.

## Parked

- The existing I3 browse pages (`i3/teams/[team_id]/**/page.tsx`) are `"use client"` pages whose `useSuspenseQuery` calls run unauthenticated during server rendering ("Switched to client rendering … User is not authenticated" in the console). This predates the branch. Fix by giving them the `page.tsx` + content split with prefetches, per `docs/patterns/detail-page-data-fetching.md`.
- `D4HTeamMemberSelect` (Issue "Recipient", Return "Returned by") lists members from every accessible team with no team label, so the same name appears several times (e.g. three "Jan Wright"s). Group or label options by team.
- The browse pages' Status column shows raw D4H codes (`OPERATIONAL`); use `D4HEquipmentStatus.label` as the item page does.

## Review notes

- (Group A, Task 4) `updateEquipmentItem`: if the post-PATCH re-fetch fails, the D4H change is unlogged and the user sees an error for a write that worked. Log `before` vs `{ ...before, ...update }` over the PATCHable fields when the re-fetch fails.
- (Group A, Task 2) Make `kind.category` lenient (`.nullable().optional()`), with the UI falling back to no label, so one odd item can't block viewing/editing.
- (Group A, Task 2) `fetchD4HEquipmentItem`: map a D4H 403 to `ForbiddenError` rather than a plain `Error` (currently a generic 500).
- (Group A, Task 3) `executeWithOutput` JSDoc: callers must pick fields, never return `output` as-is (it holds the access token). The Return procedure's `.output()` enforces it.
- (Group B, Task 6) `markApplied`/`dismiss`: the Open guard races (read then update). Add `status: "Open"` to the update `where` and map P2025 (or `updateMany` count 0) to `ConflictError`.
- (Group B, Task 7) `checkTask`: throw `ConflictError` before any D4H call when the task is no longer Open (stale list in another tab).
- (Group B, Task 7) `teamId`/`itemId` inputs: `z.number().int()`. Also align `src/lib/schemas/d4h-task.ts`'s copyright header with the other new files.
- (Group C, Task 8) Build the task `itemLabel`, log descriptions and email lines from the fetched `before.ref`/`before.kind.title`, not the client's form data (keep the client label only for "not found").
- (Group C, Task 8) Narrow the recipient-items query to the submitted ids (`id: [...]` alongside `member_id`) instead of `size: 10000`.
- (Group C, Task 8) `NotifyAdmin`: catch and log a `sendEmail` failure, so a Return that already changed D4H and queued tasks isn't reported as failed (and its draft isn't left un-Processed).
- (Group C, Task 8) Resolved 2026-10-23: Return no longer writes `notes`, so re-returning an item no longer duplicates a notes line. Remove the now-unused team-detail mock and fake timers from `processor.test.ts`.
- (Group C, Task 8) Shorten D4H PATCH failure lines for the toast/email ("D4H rejected the update (400)"), keeping the full body in `ctx.logger.error`.
