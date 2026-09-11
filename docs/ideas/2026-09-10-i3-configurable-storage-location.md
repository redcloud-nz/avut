# Configurable i3 storage location (D4H or AVUT)

**Project:** avut
**Date:** 2026-09-10 21:48
**Source:** brainstorm session

## Idea

Let an organization choose, via a single org-level config toggle, whether the i3
module records issued equipment / returns / inspections in **D4H** (current
behaviour) or in **AVUT's own tables**. The two modes are mutually exclusive — not
a sync relationship. In AVUT mode `I3IssuedItem` becomes a real store, i3 grows a
lightweight inspection record, and issuing no longer requires each user to hold a
personal D4H PAT with `Equipment.CREATE`.

The toggle already exists in the schema (`modules.i3.storage: "AVUT" | "D4H"`,
default `"D4H"`) and is settable by system admins, but nothing in the app reads it
yet. `I3IssuedItem` exists in Prisma but is referenced only by generated code.
This idea is about defining what "AVUT" mode means and wiring both up.

## Context / motivation

Three problems, all in play:

1. **D4H's write surface is too thin.** Once an equipment item exists, D4H's
   `PATCH /equipment/{id}` only accepts `status`, `isCritical`, `isMonitor`,
   `barcode`, `updateNotes`, `customFieldValues` — no kind/model/serial/cost/dates,
   and there is no move/reassign endpoint. See the parked
   [spreadsheet-tabular-editing](2026-09-10-spreadsheet-tabular-editing.md) idea.
   AVUT owning the data makes it actually editable.
2. **Some orgs don't run D4H equipment at all.** i3 should be able to stand alone
   as a lightweight issue tracker.
3. **Per-user PAT friction.** Today issuing goes through
   [`i3-issue-items/processor.ts`](../../src/forms/i3-issue-items/processor.ts),
   which needs `getPersonalD4HAccessTokenForUser` + a `whoami` check that the
   caller has `Equipment.CREATE` on the recipient team. In AVUT mode issuing needs
   only the AVUT `i3Item: ["issue"]` permission.

## Current state (what's already scaffolded)

- `modules.i3.storage` enum in
  [`organization-settings.ts:81`](../../src/lib/schemas/organization-settings.ts#L81).
  Sysadmin can set it (`system-admin-router.test.ts`). No reader anywhere.
- `I3IssuedItem` model — `personId`, `name`, `description`, `properties` Json,
  `status` — vestigial; the issue processor never writes it.
- The issue processor only does `CreateEquipmentInD4H` (POST, `location =
{ resourceType: "Member" }`) + a notify email. No `return` processor exists.
  `i3/inspect/page.tsx` is a stub.
- Templates are AVUT-native, but only become issuable via their `d4h` sidecar
  (`categoryId`/`kindId`/`brandId`/`modelId`).

## Decisions taken this session

- **Exclusive either/or, org-level.** Not a sync model — contrast with
  [d4h-linking](../specs/d4h-linking.md) (#116), which is sidecar + preview/apply.
  The toggle governs all three i3 verbs (issue / return / inspect).
- **Behaviour per verb:**

  | Verb    | D4H mode (today)                                     | AVUT mode                                                              |
  | ------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
  | Issue   | `POST /equipment`, `location = Member`               | create `I3IssuedItem`, no D4H call                                     |
  | Return  | `PATCH /equipment/{id}` `status = INACTIVE` (retire) | flip `I3IssuedItem` status (Returned / Retired) + condition            |
  | Inspect | D4H inspections API                                  | create an `I3Inspection` record + roll `nextInspectionDueAt` onto item |

- **Taxonomy in AVUT mode:** option A — issued item references template + variant
  - free-text serial. A dedicated i3 equipment-kind catalogue (option B) is
    possible later but not now.
- **Inspections in AVUT mode:** flat outcome (pass / fail / unserviceable + notes),
  stored as **separate `I3Inspection` records**, with the **next-due date denormalised
  onto the `I3IssuedItem`**.
- **Mode switching:** historical data stays in whichever store wrote it; new
  activity follows the current toggle. A migration path is desirable but secondary.

## Implied data model (AVUT mode)

- `I3IssuedItem` promoted: add `templateId` FK, `variantId` FK (nullable),
  `serial` (nullable text), `issuedAt`, `issuedByUserId`, `returnedAt` (nullable),
  `returnedCondition` (nullable), `nextInspectionDueAt` (nullable), a real status
  lifecycle (Issued / Returned / Retired). Keep `properties` Json for loose extras.
  Consider a nullable `d4hEquipmentId` for a future D4H→AVUT import.
- `I3Inspection` (new): `issuedItemId` FK, `inspectedAt`, `inspectedByUserId`,
  `outcome`, `notes`, `nextDueAt`. On write, copy `nextDueAt` to
  `issuedItem.nextInspectionDueAt`.
- Follow the transactional-writes pattern — pair each write with `ctx.logEvent`
  inside `$transaction([...])`.

## Options considered

- **Sync model (AVUT source of truth, D4H optional downstream)** — rejected by the
  user in favour of a hard exclusive toggle. Simpler mental model; cost is two
  divergent code paths in the processor (`conditionalStage` on `storage`).
- **True D4H-only mode retained** — yes, kept: D4H-mode orgs see zero behaviour
  change.
- **Structured inspection checklists in AVUT** (points / expected values, à la
  D4H) — set aside; flat outcome is enough for the PPE use case and a fraction of
  the build.
- **Lock the toggle after the first issued item** — considered for switching;
  landed on "historical stays put, new follows toggle" instead, with migration as
  a later concern.

## Open questions

- **Templates' `d4h` sidecar in AVUT mode** — ignored entirely, or still used to
  pull brand/model/kind titles as display reference data?
- **Inspection scheduling** — where does the default inspection interval come from
  in AVUT mode? Manually set `nextInspectionDueAt` per item, or derive from a
  per-template/kind interval field?
- **Migration D4H → AVUT** — import existing D4H equipment held by members as
  `I3IssuedItem` rows? One-time sysadmin action?
- **Migration AVUT → D4H** — bulk `POST /equipment` per row (the "bulk issuing"
  sliver noted in the parked spreadsheet idea).
- **Permissions** — does AVUT-mode inspection need a new `i3Inspection` permission
  set, or reuse `i3Item`?
- **`d4h-views` module** — stays independent of this toggle (it's read-only D4H
  views), confirm nothing there assumes i3 writes to D4H.
- **Return in D4H mode** — retired items linger in D4H forever (`INACTIVE`); is
  that acceptable vs `DELETE`?
- **Notify-admin email stage** — keep in both modes (currently unconditional).
- **The equipment-kinds pages under `i3/teams/[team_id]/`** currently require a D4H
  token and throw without one — they'd need to no-op or hide in AVUT mode.

## Notes

- Config: [`organization-settings.ts`](../../src/lib/schemas/organization-settings.ts),
  store in [`organization-settings-store.ts`](../../src/server/organization-settings-store.ts),
  admin UI [`organization-settings-form.tsx`](../../src/components/admin-settings/organization-settings-form.tsx)
  (needs a control for `storage`).
- Issue flow: [`i3-router.ts`](../../src/trpc/routers/i3-router.ts) `submitIssueItemsForm`
  → [`i3-issue-items/processor.ts`](../../src/forms/i3-issue-items/processor.ts)
  (`FormProcessingPipeline`; add a `conditionalStage` keyed on `storage`, or branch
  `CreateEquipmentInD4H` vs a new `CreateIssuedItemInAVUT`).
- D4H write reference: same processor's `CreateEquipmentInD4H` stage; `status`
  PATCH shape in [`schema.d.ts`](../../src/server/d4h-api/schema.d.ts) ~line 17957.
- Related: [`docs/specs/d4h-linking.md`](../specs/d4h-linking.md) (#116) — the
  sync-model contrast; [parked spreadsheet idea](2026-09-10-spreadsheet-tabular-editing.md).
