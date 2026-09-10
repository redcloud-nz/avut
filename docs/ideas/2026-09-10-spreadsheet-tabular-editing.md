# Spreadsheet-style tabular editing component for D4H data

**Project:** avut
**Date:** 2026-09-10 00:00
**Source:** brainstorm session

## Idea

A generic, reusable spreadsheet-style grid component (range select, keyboard nav,
paste from Excel, fill-down, typed per-column editors, undo/redo) to make bulk
updates to D4H data fast — the motivating case being I3 issued equipment items.
Edits would be staged locally and applied as a reviewed batch rather than written
through live, aligning with the [d4h-linking](../specs/d4h-linking.md) preview/apply
philosophy.

**Status: parked.** The D4H API is too limited on the write side for what was
envisioned (see below). The generic grid component may still be worth building for
purely AVUT-owned data, but the D4H-bulk-edit motivation doesn't hold up.

## Context / motivation

AVUT's D4H integration ([`d4h-api-router.ts`](../../src/trpc/routers/d4h-api-router.ts))
is entirely read-only today; `d4h-views/equipment` renders items through `Kaga`
tables with no edit path. Updating many items in D4H's own UI is slow and one-at-a-time.
A spreadsheet-like editor over the equipment list felt like an obvious win.

## Why it was parked — D4H API write surface

From [`src/server/d4h-api/schema.d.ts`](../../src/server/d4h-api/schema.d.ts):

| Operation       | Endpoint                                                              | Editable fields                                                                                                                                                                                                                                                                             |
| --------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create item     | `POST /v3/{context}/{contextId}/equipment`                            | ref, categoryId, kindId, brandId, modelId, supplierId, supplierRefId, fundId, **location** (Member/EquipmentLocation/Team/Equipment), quantity, notes, barcode, serial, replacementCost, weight, dateManufactured, datePurchased, dateWarranty, dateExpires, idMarks, isCritical, isMonitor |
| **Update item** | `PATCH /v3/{context}/{contextId}/equipment/{itemId}`                  | **only** `status` (OPERATIONAL/UNSERVICEABLE/LOST/WISHLIST/INACTIVE), `isCritical`, `isMonitor`, `barcode`, `updateNotes`, `customFieldValues`                                                                                                                                              |
| Delete item     | `DELETE /v3/{context}/{contextId}/equipment/{itemId}`                 | —                                                                                                                                                                                                                                                                                           |
| Repairs         | `POST` / `PATCH /v3/{context}/{contextId}/repairs/{repairId}`         | ref, status, cause, cost, dueAt, completedAt, description, assignedMemberId, activityId, fundId                                                                                                                                                                                             |
| Activity usage  | `POST` / `PATCH /v3/{context}/{contextId}/equipment-usages/{usageId}` | duration, distance, used (per activityId)                                                                                                                                                                                                                                                   |

Decisive limitations:

- **Once an item exists, almost nothing is editable.** No kind, model, brand, serial,
  name, replacement cost, weight, or the purchase/warranty/**expiry** dates — all
  create-time only.
- **No move / reassign endpoint.** You cannot change which member or location holds
  an item after creation. The I3 issue flow
  ([`src/forms/i3-issue-items/processor.ts`](../../src/forms/i3-issue-items/processor.ts))
  only works because it _creates_ a new item with `location = { resourceType: "Member" }`.
- So a live bulk editor over existing issued items could only touch status, the
  critical/monitor flags, barcode, and custom-field values — plus bulk create and
  bulk delete. Not the "fix up all the wrong data" workflow that motivated it.

The one genuinely useful, API-supported slice: **custom-field values** (orgs park
PAT-test / next-inspection / condition data there) and **bulk status changes**
(retire a batch, mark a batch unserviceable).

## Options considered

- **Live write-through per changed cell** — rejected: collides with the read-only,
  `"use cache"` D4H layer, and the write surface is too thin to justify it.
- **Staged edits + reviewed batch apply** (mirrors d4h-linking #116 sidecar
  preview/apply) — the preferred model _if_ the idea were pursued.
- **Ephemeral (React state) vs persisted (Prisma "edit session") staging** — left
  unresolved; persisted would allow leave-and-resume and a diff view.
- **Generic `<SpreadsheetGrid>` block vs a bespoke equipment bulk-edit screen** —
  user wanted the generic reusable component (would sit in
  [`src/components/blocks/`](../../src/components/blocks/) alongside `Kaga` / `Glorious`).

## Open questions

- Is there value in the generic spreadsheet grid on its own, for AVUT-owned data
  (I3 templates/variants, skill-track catalogues, personnel imports)? That doesn't
  depend on the D4H API at all.
- Bulk _issuing_ (paste a column of serials → create N items against one member) is
  fully API-supported via `POST /equipment` and could be a much smaller, focused
  feature than a general grid. Worth splitting out?
- Do D4H's undocumented / non-v3 endpoints expose a move operation? (Not verified.)
- Would D4H add a fuller equipment `PATCH` on request?

## Notes

- Existing D4H write example: `i3-issue-items/processor.ts` `CreateEquipmentInD4H`
  stage — POSTs equipment, gated on the caller's D4H `Equipment.CREATE` permission
  via `fetchD4HWhoamiCached`.
- Table prior art: `Kaga` (TanStack Table wrapper), `Glorious` (full-height matrix),
  `Eagle` (JSON diff/parse) — the last is relevant to a staged-diff view.
- Related: [`docs/specs/d4h-linking.md`](../specs/d4h-linking.md), tracking issue #116.
