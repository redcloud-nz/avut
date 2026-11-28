# Self Audit Campaigns: needs report and D4H fixes

**Date:** 2026-11-28
**Branch:** `feat/self-audit-fixes` in `.claude/worktrees/self-audit-fixes` (dev server port 3106)
**DB:** no migration; shared `avut`.
**Written against:** integration @ f91931be
**Source:** [#579](https://github.com/redcloud-nz/avut/issues/579), stage 3 of #576. Builds on [2026-11-27-self-audit-campaigns.md](2026-11-27-self-audit-campaigns.md).

Once members have answered a Self Audit Campaign, two new pages under the campaign turn the answers into (a) a purchase list and (b) corrections to D4H's issued-equipment records.

## Decisions

1. **What the reports read.** Only `SelfAuditRequest.submittedData` of requests that are submitted and not withdrawn (`submittedAt != null && withdrawnAt == null`). Working copies (`formInstance.formData`) of unsubmitted or reopened forms are ignored; a reopened form counts with its last submitted answer.
2. **A need** is `wantsOne(answer)` (`src/lib/self-audit-validate.ts`): a held item answered Yes with `replace`, or a held/missing line answered No with a `wantVariantId` other than `NOT_NEEDED`. The variant label: `wantVariantId` when it's a variant id; `ANY_VARIANT` → "Any" (as `self-audit-summary.tsx` renders it); `OTHER_VARIANT` → "Other". For `replaceWith: "same"`: the held item's snapshot `variantId`, else the answer's `variantId` (`OTHER_VARIANT` → "Other"), else "Unknown". A template with no variants and no want variant: "—". Size: `answer.size` trimmed, `""` → "No size given".
3. **Needs report** groups needs by template (in the campaign's stored `templates` order), then variant label, then size; each group carries a count and the member names (sorted). Extra rows with `kind: "need"` are listed separately: member, item, size, notes. **CSV** (one file): one row per need, not per group (`Template, Variant, Size, Member, Reason, Notes`, Reason = `Replacement` | `Has none`, then extra rows with `Template` = `(not on list)`, `Variant` = the item text). Cells through `csvCell`, which moves from `src/server/services/public-forms.ts` to `src/lib/csv.ts` (`public-forms.ts` imports it back).
4. **Differences are computed against live D4H** (chosen by the user). The live comparison re-runs `compareBundle()` on the campaign's D4H team with the team's equipment (always fetched uncached), but its **members are the campaign's qualifying requests** (`d4hMemberId`, `memberName`), not the D4H team's current member list, so a member who has since left the team is still compared. `snapshotCampaignMembers` is refactored so the caller can pass the members to compare (send/add keep passing the D4H team's members), and so it also returns, per member and per stored template, the counted live items of that template's column (the `compareBundle` cell, which counts by D4H kind), not only the first-template-wins `heldItems`. A stored template absent from the fresh comparison's `columns` (its I3 template since deleted or unlinked from D4H) yields no differences: its lines are shown as info "Template no longer linked to D4H".

   Per member, comparing their submitted answer with the request's snapshotted `heldItems` and the member's live items:
   - **`NotHeld`**: a snapshotted held item answered No that the member still live-holds. Fix: `PATCH` status → `LOST` (chosen by the user). **Suppressed** (state `info`, "Returned: retire task open") when the item has an open `Retire` task: an I3 Return leaves the item located with the member until it's retired by hand.
   - **`Serial`**: a held item answered Yes with a non-blank `answer.serial` that differs (trimmed) from the live item's serial. Fix: queue a `SetSerial` task.
   - **`Variant`**: a held item answered Yes with an `answer.variantId` that is a real variant (not `""`, not `OTHER_VARIANT`) and differs from the live item's matched `variantId`. Fix: queue a `SetVariant` task with the variant's **current** D4H brand/model titles (`I3TemplateVariant_D4H`); `unavailable` ("Variant no longer linked to D4H") when it has none.
   - **`Unrecorded`**: a missing template answered Yes where the member live-holds **no counted item in that template's column** (by D4H kind, so once the POSTed item appears the difference converges and drops out). Fix: create the item in D4H (chosen by the user), `POST` as I3 Issue does: category/kind from the template's **current** `I3Template_D4H`, brand/model from `answer.variantId` when it's a real variant with a D4H record, serial from `answer.serial` when non-blank, location the member. Limitation, accepted: when two templates share a D4H kind, an item of the first counts for the second, so a second item of a shared kind isn't offered.
   - **`Gone`** (information only, no fix): a held item answered Yes that the member no longer live-holds (moved, deleted, LOST).
   - `unsure`, unanswered, `OTHER_VARIANT`, and extra `have` rows produce nothing.
   - **A member no longer in the D4H team** is compared as above (items located with them still show in the team's equipment), but `Unrecorded` is `unavailable` ("No longer in the D4H team"): AVUT doesn't create items located with an ex-member. The page labels the member card "No longer in the D4H team".

   Each difference has a stable `key` (`<kind>:<itemId>` or `unrecorded:<templateId>`) and a `label` for display (`#<ref> <description>` style, like `D4HTask.itemLabel`).

5. **Queued state.** A difference with an open `D4HTask` on the same `resourceId` and of the kind its fix would queue (`SetSerial`, `SetVariant`, or `MarkLost` for `NotHeld`) shows as "Queued" and can't be selected. For `NotHeld` an open `MarkLost` task counts as Queued even when the token now has UPDATE, so the item isn't PATCHed and the task left orphaned. A difference whose fix is a D4H write has no other queued state: once applied, the live comparison drops it.
6. **D4H permission fallback.** The page reads the token's whoami (cached is fine for display) for D4H `Equipment UPDATE` and `CREATE` on the campaign's D4H team (`hasD4HTeamPermission`, `src/lib/d4h-permissions.ts`). Apply re-reads it uncached (`fetchD4HWhoami`, as `requireD4HTeamPermission` does) and decides per fix:
   - `NotHeld` without UPDATE → queue a **`MarkLost`** task instead of the `PATCH`.
   - `Unrecorded` without CREATE → **unavailable**: shown disabled with "Needs D4H Equipment CREATE". A manual "record this item" task would need `D4HTask.resourceId` nullable (a migration); out of scope.
   - Task fixes need no D4H permission to queue (they write only to AVUT).
     Before a POST, the template is re-checked against the team as I3 Issue's `CheckTemplateFit` stage does; a template that no longer fits is `failed` with the reason.
7. **New `D4HTask` kinds** `SetSerial` (`{ serial, note? }`), `SetVariant` (`{ brand, model, note? }`, the D4H brand/model titles), `MarkLost` (`{ note? }`). No schema change: `kind` is a string and `payload` Json. Each task carries `formInstanceId` = the request's form instance and a note naming the campaign and member ("Self-audit <campaign>: <member> reported …"). The Returned badge and `listOpenRetireItemIds` stay Retire-only.
   **Check becomes kind-aware.** `d4hTasksRouter.checkTask` today marks a task Done when the fetched item is `RETIRED`, and the client toasts "not retired yet". Per kind: `Retire` → `status === "RETIRED"` (unchanged); `SetSerial` → `item.serial` (trimmed) equals `payload.serial`; `SetVariant` → the item's brand and model titles equal the payload's; `MarkLost` → `status === "LOST"`. The "not applied yet" toast names what's still to do per kind. Check's D4H permission gate follows the kind (`RETIRE` for Retire, `UPDATE` for the new kinds), on the server and in `<Protect>`-style gating on the client, if the current gate is per-permission; otherwise keep it as is and note it.
8. **Apply is per member** (chosen by the user): the member's differences each with a checkbox; "Apply selected" sends the request id and the selected keys. The service **recomputes** that member's differences live and acts only on keys still present and selectable; stale keys are reported as skipped, never acted on from client data. Withdrawn or unsubmitted requests are rejected. One `LogBatch` per apply, opened lazily on the first write (as `return-items.ts`'s `openBatch()`), so an all-stale apply writes nothing (`Operations` gains `self-audit-apply-fixes`). Each D4H write is logged after it succeeds (D4H calls can't join a `$transaction`; `docs/patterns/transactional-writes.md`) as the existing D4H PATCH does (`d4h-api-router.ts`): `objectType: "D4HEquipmentItem"`, `objectId: String(itemId)`, action `Update` with a `diffObject` change for the PATCH, `Create` for the POST (so `createD4HEquipmentItem` returns the new item's id), each with `refs: [{ objectType: "SelfAuditRequest", objectId, role: "context" }]`. Task creations log through `D4HTasks.createTask` (its description names the kind) inside the same batch. A failed D4H write doesn't stop the rest; the result lists `applied`, `queued`, `skipped` and `failed` (with D4H's message), and carries `campaignId`.
9. **Pages** (sub-pages of the campaign, keeping `campaign-content.tsx` from growing): `/orgs/[slug]/d4h-i3/self-audit-campaigns/[campaign_id]/needs` ("Needs Report") and `…/[campaign_id]/differences` ("Differences from D4H"). Trail: `Self Audit Campaigns › <campaign name>`. Linked from the campaign page's header as buttons, shown once the campaign is sent. CSV at `…/[campaign_id]/needs/csv` (a `route.ts`, modelled on `admin/forms/chch-soft-shell-jacket/answers/route.ts`). Access unchanged: system admins (`selfAuditProcedure`). Both pages go on `help-cards.test.ts`'s opt-out list. Run `npx next typegen` after adding each page (`npm run check` does it too).
10. **No D4H token**: differences and apply → PRECONDITION_FAILED via `getConfiguredD4HAccessToken`. The differences page doesn't server-prefetch its D4H query, so the error reaches the client, which shows the no-token alert from `campaign-d4h-gate.tsx` (extracted into a page-usable piece; the dialog fallback keeps using it). The needs report reads only AVUT and works without one.

## Tasks

### Review group A: needs report and task kinds

- [x] **1. Needs report (pure + service + router)** (feat(d4h-i3): self audit campaign needs report). Notes: `getNeedsReportCsv` added to the service for task 5's route; `needsReportCsv` takes `buildNeedsReport`'s input; csvCell tests moved to `src/lib/csv.test.ts`.
  - **Files:** new `src/lib/csv.ts` (moved `csvCell`), `src/server/services/public-forms.ts` (import it), new `src/lib/self-audit-needs.ts` (+ test), `src/server/services/self-audit-campaigns.ts` (`getNeedsReport`), router `getNeedsReport` (+ test).
  - **Do:** Decisions 1–3. Pure `buildNeedsReport({ templates, requests: { memberName, heldItems, submittedData }[] })` → `{ groups: { templateId, templateName, category, variantLabel, size, count, members[] }[], extras: { memberName, item, size, notes }[] }` and `needsReportCsv(...)`. Service reads the campaign's stored templates and qualifying requests. Router query input `{ campaignId }` (organization injected by `organizationProcedure`), like `getCampaign`.
  - **Done when:** unit tests cover replacement same/different (incl. `OTHER_VARIANT`), has-none with/without size, `ANY_VARIANT` → "Any", `NOT_NEEDED` excluded, `unsure` excluded, withdrawn and unsubmitted excluded, extras, grouping order, CSV escaping; `npm run check` passes.
- [x] **2. New D4H task kinds and kind-aware Check** (feat(d4h): self-audit task kinds and kind-aware Check). Notes: Check's pending result also returns serial/brand/model for the toast; client gating stays on AVUT `d4hTask: ["apply"]`; list/dismiss still require D4H RETIRE (see Review notes).
  - **Files:** `src/lib/schemas/d4h-task.ts`, `src/server/services/d4h-tasks.ts` (+ test), `src/trpc/routers/d4h-tasks-router.ts` (+ test), `src/modules/d4h/components/tasks/d4h-task-changes.tsx`, `src/modules/d4h/components/tasks/d4h-task-actions.tsx`.
  - **Do:** Decision 7. Add the kinds and payload schemas to the discriminated unions; add `createTask(ctx, { d4hTeamId, itemId, itemLabel, formInstanceId?, ...D4HTaskPayload })` (generalising `createRetireTask`, which stays as a thin wrapper so the Return processor is untouched), its log description naming the kind. `d4hTaskChanges` renders `SetSerial` → Serial, `SetVariant` → Brand + Model, `MarkLost` → Status `Lost`. `checkTask` checks per kind; the actions' toast wording per kind.
  - **Done when:** tests create each new kind and round-trip it through `D4HTask.fromRecord`; `checkTask` tests per kind (applied → Done; not applied → stays Open; a retired item doesn't complete a `SetSerial`); Retire behaviour unchanged; `npm run check` passes.

### Review group B: differences and apply

- [ ] **3. Differences (pure) and the live comparison refactor**
  - **Files:** new `src/lib/self-audit-differences.ts` (+ test), `src/server/services/self-audit-campaigns.ts` (`snapshotCampaignMembers` refactor) (+ test).
  - **Do:** Decisions 4–6. Refactor `snapshotCampaignMembers` per decision 4 (caller-supplied members; per-template counted live items alongside `heldItems`; the set of stored templates present in the fresh comparison); send/add behaviour unchanged. Pure `diffAnswers({ templates, liveTemplateIds, snapshotHeld, live, answer, openTasks: { resourceId, kind }[], permissions: { update, create }, inTeam, variantD4H, templateD4H })` → `SelfAuditDifference[]`: `{ key, kind, label, detail, fix: { type: "patch-lost" | "create" | "task", taskKind? } | null, state: "selectable" | "queued" | "unavailable" | "info", reason? }`. No I/O.
  - **Done when:** tests for every kind and non-kind in decision 4; open Retire suppresses `NotHeld`; open `MarkLost` is Queued with UPDATE; Queued matching for task kinds; both permission fallbacks; `OTHER_VARIANT`; an item answered No that already left the member (no difference); an unlinked template (info only); a member out of the team (`Unrecorded` unavailable); `Unrecorded` absent once the member live-holds an item of that kind; existing send/add tests pass; `npm run check` passes.
- [ ] **4a. `listDifferences` service and router query**
  - **Files:** `src/server/services/self-audit-campaigns.ts` (+ test), router (+ test).
  - **Do:** Decisions 4–6, 10. `listDifferences(ctx, { accessToken, campaignId })`: the refactored live comparison over the qualifying requests, current members of the D4H team (for `inTeam`), whoami for permissions, open tasks for the D4H team (`D4HTasks.listOpen`), current I3 D4H links for templates and variants, then `diffAnswers` per request → `{ permissions, members: { requestId, memberName, inTeam, differences }[] }` (members with no differences included). Router query input `{ campaignId }`.
  - **Done when:** tests: shapes for a mixed campaign, withdrawn/unsubmitted excluded, another org's campaign NOT_FOUND, no token PRECONDITION_FAILED; `npm run check` passes.
- [ ] **4b. `applyFixes`**
  - **Files:** `src/server/d4h-api/equipment.ts` (new `createD4HEquipmentItem`, returning the new id, extracted from `src/forms/i3-issue-items/processor.ts`, which then uses it), `src/server/services/self-audit-campaigns.ts` (`applyFixes`) (+ test), `src/lib/operations.ts`, router mutation (+ test), `src/client/self-audit-campaigns-effects.ts`.
  - **Do:** Decisions 6–8. `applyFixes(ctx, { accessToken, requestId, keys }, deps?)` with `patchD4HEquipmentItem` (`status: "LOST"`, `updateNotes`), `createD4HEquipmentItem` and the whoami fetch injectable for tests. The mutation's `meta.effects` invalidate `listDifferences` (keyed on the returned `campaignId`), the D4H task lists (`d4hTasks` open/item lists) and the `d4hApi` equipment queries, mirroring `src/client/d4h-tasks-effects.ts`.
  - **Done when:** tests: each fix type applied (PATCH body, POST body, task created with `formInstanceId` and note), fallback to `MarkLost` without UPDATE, `Unrecorded` refused without CREATE, template fit re-check failure, stale key skipped, D4H failure on one key doesn't stop the next and is reported, withdrawn and unsubmitted requests rejected, all-stale apply writes no log batch, log entries' object types and refs; I3 Issue processor tests still pass; `npm run check` passes.

### Review group C: UI (one visual checkpoint at the end)

- [ ] **5. Needs report page and CSV** `visual`
  - **Files:** `src/app/(wrapper)/(authenticated)/orgs/[slug]/d4h-i3/self-audit-campaigns/[campaign_id]/needs/{page.tsx,csv/route.ts}`, new `src/modules/d4h-i3/components/self-audit-campaigns/campaign-needs.tsx`, `campaign-content.tsx` (the "Needs Report" header button), `src/components/docs/help-cards.test.ts`.
  - **Do:** Decisions 3, 9. Page per `docs/patterns/detail-page-data-fetching.md` (prefetch + `HydrateClient`, `Std.ScrollContainer`, trail in the content). Needs as a table grouped by template (Variant, Size, Count, Members), matching neighbouring pages; an "Other needs" table for extras; a "Download CSV" button linking the route. Empty state when no submitted needs.
  - **Done when:** the page renders on 3106 for a sent campaign with submitted answers; CSV downloads; `npm run check` passes.
- [ ] **6. Differences page and apply** `visual`
  - **Files:** `…/[campaign_id]/differences/page.tsx`, new `campaign-differences.tsx`, new `apply-fixes-dialog.tsx`, `campaign-d4h-gate.tsx` (page-usable alert), `campaign-content.tsx` (the "Differences from D4H" header button), `help-cards.test.ts`.
  - **Do:** Decisions 4–10. One card per member (members with differences first, then a collapsed "Match D4H" list; a "No longer in the D4H team" label where it applies). Each difference: checkbox (selectable only), what D4H has vs what they said, and what applying does ("Mark LOST in D4H", "Create in D4H", "Queue task: set serial to X", or the disabled reason / "Queued" / info). "Apply selected (n)" per card opens a confirm dialog (`?action=apply&requestId=…`, `docs/patterns/mutation-dialog.md`) listing the actions; on success a toast summarises applied/queued/skipped/failed. A note when the token lacks UPDATE/CREATE on the team.
  - **Done when:** on 3106: differences render for a submitted member; applying a task fix queues it (visible on `/orgs/[slug]/d4h/tasks`) and the row turns "Queued"; `npm run check` passes. D4H writes are checked only on the user's say-so (real records).

## Docs impact

No guide pages: the campaign pages are system-admin only and unlinked. The D4H Tasks help card (`content/help/d4h.mdx`) gains three task kinds (Set serial, Set brand/model, Mark lost) and kind-aware Check; for `/avut-docs`.

## Out of scope

- A manual "record this item" task for `Unrecorded` without D4H CREATE, or for a member who left the team (needs a nullable `D4HTask.resourceId`).
- A second item of a D4H kind shared by two templates (decision 4).
- Reconciling extra `have` rows against D4H.
- Fulfilling needs (issuing replacements) from the report.
- #583 (use my own), #584 (optional lines), #580 (ordering).

## Parked

(none yet)

## Review notes

- Task 1: `getNeedsReport`'s `.output()` schema in `self-audit-campaigns-router.ts` is written inline and duplicates the TS types in `src/lib/self-audit-needs.ts`. Define a Zod schema for the report beside the types (or in `src/lib/schemas/self-audit.ts`), derive the types with `z.infer`, and pass it to `.output()`.
