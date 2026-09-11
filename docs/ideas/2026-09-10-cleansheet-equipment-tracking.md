# Cleansheet equipment tracking — lots, holders, movements

**Project:** avut
**Date:** 2026-09-10 22:40
**Source:** brainstorm session

## Idea

Design AVUT-native equipment tracking from scratch, replacing the D4H equipment
model that i3 currently wraps. The core atom is a **`Lot`**: N identical units in
one place, with an optional expiry and an optional asset tag (a tag ⟺ quantity 1 ⟺
an individually-tracked item). Everything else — the quartermaster's "how many
size-9 boots do we have" stockpile view, issuing to a person, assigning to a case,
consumption, inspections — is expressed over lots plus two ledgers: a `Movement`
row for every quantity change and an `Assignment` row for every tracked-item
custody change.

## Context / motivation

D4H's equipment module is the thing i3 fights. Specific failures:

- **Built for "a team owns a pile of gear"**, not "a person is issued PPE".
- **Anaemic write API** — `PATCH /equipment/{id}` only accepts `status`,
  `isCritical`, `isMonitor`, `barcode`, `updateNotes`, `customFieldValues`. No
  serial/model/cost/date edits, no move/reassign endpoint.
- **Broken taxonomy** — models aren't actually associated with categories or
  kinds; it's four flat levels you hand-populate.
- **`Member` is abused as a location** — conflates "where is it" with "who is
  accountable".
- **Awkward UI.**
- **Uniform can't be tracked** — items aren't individually labelled, so there's no
  "item" to assign, yet issuing needs one. Prior GH issue #31 proposed a
  "stockpile quantity" module to paper over this.

Distinct from [i3-configurable-storage-location](2026-09-10-i3-configurable-storage-location.md),
which is an incremental "make the existing D4H|AVUT toggle actually work". This is
the cleansheet the concept deserves. The user's stated intent was to explore the
concept, not commit to a module build yet.

## The model

### `Lot` — the only stored "stuff we have" entity

- `modelId?` (nullable — generic unbranded stock sits at type level), `variant`
  (size/spec), `holder` (polymorphic), `quantity`
- `expiry?` — null for earplugs; set per-batch for meals, flares, batteries
- `assetTag?` / `serial?` — present ⟺ `quantity = 1` ⟺ individually tracked
- `status`, timestamps

| Real-world thing           | Lots                                                 |
| -------------------------- | ---------------------------------------------------- |
| 40 earplugs in store       | `Lot(qty 40, exp null, holder=Store)`                |
| 10 meals, two batches      | `Lot(qty 6, exp 2027-01)`, `Lot(qty 4, exp 2027-06)` |
| 10 earplugs issued to Fred | `Lot(qty 10, holder=Fred)`                           |
| Helmet H-0042 on Alex      | `Lot(qty 1, tag H-0042, holder=Alex)`                |
| 20 boxed helmets, untagged | `Lot(qty 20, exp 2031, holder=Store)`                |

### Holder — polymorphic pointer

- **`Store`** — roots of the containment tree.
- **`Container`** — Case 12, kit bags, vehicle stowage. Nest arbitrarily. Team
  equipment behaves differently from personal issue — it's "assigned to Case 12",
  not "issued to a person".
- **`Person`** — leaves. Carry **accountability** behaviour the other holder types
  don't: issue receipt, a card on the person's profile, a block/checklist item on
  offboarding.

One `holder` FK covers all three. D4H's sin was making Member a _location_; here a
Person is a legitimate holder, it just additionally triggers accountability
semantics. No case needs a person _and_ a separate location simultaneously
(confirmed in session).

### StockLine — derived, not stored

`GROUP BY (model/type, variant, holder)` over available lots. The quartermaster's
count. Storing it as a real `quantity: int` (GH #31's instinct, and the user's
initial lean) does **not** survive per-unit expiry: 10 meals with different dates
already force sub-groups, and once you have those the int was never the real row.

### `Movement` — the quantity ledger

Every delta to a lot's quantity is a row with a reason:
`received | issued | returned | consumed | lost | damaged | disposed | corrected`
(`corrected` = stock-take adjustment).

- Issue 6 gloves → split `Lot(40, Store)` into `Lot(34, Store)` + `Lot(6, Fred)`;
  one `issued` movement.
- Issue 20 flares as consumed → one `issued` movement, no holder, done.
- "Ask Fred how many earplugs he has" → `corrected` movement on Fred's lot
  (10 → 3), optionally a `consumed` movement for the missing 7.
- Return 6 gloves → merge `Lot(6, Fred)` back into the store lot on
  matching `(model, variant, expiry)`. A returned jacket does the same — **no
  continuity**; the system correctly doesn't claim it's the same jacket.

### `Assignment` — tracked-item custody history

`(lotId, holder, issuedAt, issuedBy, returnedAt, returnedBy, condition)`. Only
minted for `quantity = 1` tracked lots. Gives H-0042 a real timeline query rather
than log-entry archaeology. Return keeps the _same_ lot row (holder flips back to
Store), so history is never orphaned.

### Minting a tracked item

Type config `tracked: bool`. A pile of new helmets is `Lot(qty 20)` with no tags.
First issue forces a split into a `quantity = 1` lot and assigns the asset tag at
that moment. Fungible types never mint.

### Taxonomy

D4H's is flat and unlinked. Proposed, with **Brand and Model as real entities**
(user's call — supports a shared catalogue and recall tracking):

- **Category** — broad grouping (Head Protection, Footwear, Rations).
- **Type** — functional class; **carries the config**: `tracked`, inspectable,
  expiry behaviour, default inspection interval (Helmet, Safety Boot, Dehydrated
  Meal).
- **Brand** — manufacturer (Petzl, Bata).
- **Model** — a real product, belongs to **one Brand and one Type** (this link is
  exactly what D4H drops). "Petzl Vertex Vent".
- **Variant** — purchasable spec on a model/type: size, colour. A `Lot` points at
  a Model + Variant, or at just a Type + Variant for generic unbranded stock.

### Inspections

Basic / flat, matching the sibling idea: outcome (pass / fail / unserviceable) +
notes + `nextDueAt`, stored as separate inspection records with next-due
denormalised onto the lot. No structured checklists in v1.

## Options considered

- **Quantity-first `StockLine` with optional linked items (GH #31, user's initial
  lean)** — set aside; per-unit expiry (10 meals, 10 dates) means you need lots
  under the quantity regardless, so the stored int is redundant and creates a
  two-representation sync problem for the hybrid case.
- **Items-only, no quantity at all (serial=null items forever)** — rejected;
  "issue 6 gloves" creating 6 permanent rows doesn't match how a quartermaster
  thinks. The `Lot` with `quantity` is the compromise: one entity, but N units per
  row.
- **Unified location tree (Person as just another tree node)** — rejected for the
  same reason D4H's is wrong: it flattens accountability. Kept the polymorphic
  `holder` with Person carrying extra semantics instead.
- **Separate custody and location axes** — rejected as two things to maintain with
  no case that needs both at once.
- **D4H stays source of truth for team equipment, AVUT owns only issued items** —
  possible, but the `Lot` model arguably makes the split unnecessary: D4H
  equipment imports as tracked lots and the distinction dissolves.

## Open questions

- **New module vs rebuild i3 in place.** Name if new. Relationship to the existing
  `i3` module id and its templates (which are AVUT-native but only issuable via a
  `d4h` sidecar today).
- **D4H migration** — one-time importer turning D4H equipment held by members into
  tracked `Lot`s? Does D4H equipment keep syncing, or is it a clean break?
- **Consumables that are never in stock** (issued and immediately consumed) — is
  "issue as consumed" always a single movement, or is there ever a disposal step
  for team-held consumables written off later?
- **Lot merge rules on return** — exact match key. `(model, variant, expiry,
holder)`? What about condition — does a used-but-serviceable returned item merge
  with pristine stock, or land in a separate "used" lot?
- **Container lifecycle** — are Cases/kit bags themselves `Lot`s (a case is
  equipment too) or a separate entity? Recursion: a case inside a vehicle inside…
- **Cost / procurement** — track purchase cost, supplier, PO on receipt? Out of
  scope or core?
- **Where does the asset-tag scheme come from** — org-configured prefix +
  sequence, scanned barcode, manual?
- **Permissions** — reuse i3's `i3Item` / `i3Template`, or a fresh set
  (`lot: ["issue","return","adjust"]`, `equipmentType: ["manage"]`,
  `inspection: ["record"]`).

## Notes

- Prior art / entry points:
  - i3 module: [`src/trpc/routers/i3-router.ts`](../../src/trpc/routers/i3-router.ts),
    [`src/forms/i3-issue-items/`](../../src/forms/i3-issue-items/) (the
    `FormProcessingPipeline` the current issue flow runs through),
    [`src/app/(authenticated)/orgs/[slug]/i3/`](<../../src/app/(authenticated)/orgs/[slug]/i3/>).
  - `I3IssuedItem` / `I3Inspection` Prisma models — vestigial scaffolding the
    sibling idea also wants to promote.
  - `modules.i3.storage: "AVUT" | "D4H"` enum in
    [`organization-settings.ts`](../../src/lib/schemas/organization-settings.ts).
  - D4H equipment schema: [`src/server/d4h-api/schema.d.ts`](../../src/server/d4h-api/schema.d.ts).
  - `src/lib/modules.ts` — module registry, if this becomes its own module.
- Related GH issues: #31 (stock module — this supersedes the approach), #25
  (generic equipment view/edit page), #32/#33 (D4H retire/edit API limits — the
  motivation), #34–#37 (return process, receipts), #23 (linked teams not raw D4H).
- Related ideas: [i3-configurable-storage-location](2026-09-10-i3-configurable-storage-location.md)
  (incremental sibling), [spreadsheet-tabular-editing](2026-09-10-spreadsheet-tabular-editing.md)
  (parked — D4H bulk edit, blocked by the same anaemic API),
  [`docs/specs/d4h-linking.md`](../specs/d4h-linking.md) (#116 — sidecar link + sync
  model, the contrast pattern).
- Follows repo conventions: pair each write with `ctx.logEvent` inside
  `ctx.prisma.$transaction([...])`; multi-entry operations (a D4H import minting
  many lots) use a `LogBatch` + `Operations` registry key.
