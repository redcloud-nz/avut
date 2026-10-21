/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { DiffChange } from "@/lib/diff";

import { PersonId } from "./person";
import { TeamMembershipId } from "./team-membership";

//
// Persisted D4H sync plan — the payload of a `d4h-team-sync` `BatchUpdatePlan` row
// (`src/server/services/batch-update-plans.ts`). Built by the pure `buildD4HSyncPlan`
// (`src/server/services/d4h-team-sync.ts`) and executed item by item from the stored row, so it
// carries everything execution needs: no D4H token, no D4H fetch. See
// docs/plans/2026-10-19-d4h-sync-plans.md.
//

/** The `TeamMembership_D4H` snapshot fields. `d4hStatus` is stored verbatim from D4H. */
const membershipSnapshotSchema = z.object({
    d4hStatus: z.string(),
    d4hPosition: z.string().nullable(),
    d4hRef: z.string().nullable(),
    d4hRoleId: z.number().nullable(),
});

/** The `Team_D4H` cache fields a sync refreshes. */
const teamFieldsSchema = z.object({
    d4hTeamName: z.string(),
    d4hOrganisationId: z.number().nullable(),
    d4hTimezone: z.string().nullable(),
});

/** The `Organization_D4H` cache fields as they arrive from D4H. */
const orgFieldsSchema = z.object({
    d4hOrganisationName: z.string(),
    d4hTimezone: z.string(),
    d4hCurrency: z.string(),
    d4hReportingStartDay: z.number(),
    d4hReportingStartMonth: z.number(),
});

/** Each `Team_D4H` cache field, mapped to its key in the metadata item's flat display diff. */
export const D4H_TEAM_FIELD_DISPLAY_KEYS = {
    d4hTeamName: "d4hTeamName",
    d4hOrganisationId: "d4hOrganisationId",
    d4hTimezone: "d4hTimezone",
} as const satisfies Record<keyof z.infer<typeof teamFieldsSchema>, string>;

/** Each `Organization_D4H` cache field, mapped to its display key: the same, prefixed `org`. */
export const D4H_ORG_FIELD_DISPLAY_KEYS = {
    d4hOrganisationName: "orgName",
    d4hTimezone: "orgTimezone",
    d4hCurrency: "orgCurrency",
    d4hReportingStartDay: "orgReportingStartDay",
    d4hReportingStartMonth: "orgReportingStartMonth",
} as const satisfies Record<keyof z.infer<typeof orgFieldsSchema>, string>;

/** A metadata field as the plan's display diff and an outcome's `skippedFields` name it. */
export type D4HSyncMetadataFieldKey =
    | (typeof D4H_TEAM_FIELD_DISPLAY_KEYS)[keyof typeof D4H_TEAM_FIELD_DISPLAY_KEYS]
    | (typeof D4H_ORG_FIELD_DISPLAY_KEYS)[keyof typeof D4H_ORG_FIELD_DISPLAY_KEYS];

/** The `Organization_D4H` cache fields as stored in AVUT — null until first cached. */
const storedOrgFieldsSchema = z.object({
    d4hOrganisationName: z.string().nullable(),
    d4hTimezone: z.string().nullable(),
    d4hCurrency: z.string().nullable(),
    d4hReportingStartDay: z.number().nullable(),
    d4hReportingStartMonth: z.number().nullable(),
});

/**
 * D4H member with no D4H-linked AVUT membership: find (by email) or create the person, then
 * create a membership or take over a manual one. `itemId` is `add:<d4hMemberId>`.
 */
const addItemSchema = z.object({
    kind: z.literal("add"),
    itemId: z.string(),
    d4hMemberId: z.number(),
    /** The D4H member's name — the new person's name when none matches by email. */
    personName: z.string(),
    email: z.string(),
    incoming: membershipSnapshotSchema,
    /** Plan-time: a non-`Deleted` person already has this email. */
    personMatch: z.enum(["existing", "new"]),
    /** Plan-time: a non-`Deleted` manual membership already joins this person to the team. */
    adoptsMembership: z.boolean(),
});

/**
 * Active D4H-linked membership whose snapshot changed in D4H. `itemId` is
 * `update:<teamMembershipId>`.
 */
const updateItemSchema = z.object({
    kind: z.literal("update"),
    itemId: z.string(),
    teamMembershipId: TeamMembershipId.schema,
    personId: PersonId.schema,
    personName: z.string(),
    d4hMemberId: z.number(),
    /** The stored snapshot at plan time — the executor's precondition. */
    before: membershipSnapshotSchema,
    incoming: membershipSnapshotSchema,
    changes: z.array(DiffChange.schema),
});

/**
 * Archived D4H-linked membership whose member reappeared in D4H. `itemId` is
 * `reactivate:<teamMembershipId>`.
 */
const reactivateItemSchema = z.object({
    kind: z.literal("reactivate"),
    itemId: z.string(),
    teamMembershipId: TeamMembershipId.schema,
    personId: PersonId.schema,
    personName: z.string(),
    d4hMemberId: z.number(),
    incoming: membershipSnapshotSchema,
    /** Snapshot changes, if any, applied alongside the reactivation. */
    changes: z.array(DiffChange.schema),
});

/**
 * Active D4H-linked membership whose member is no longer in D4H. `itemId` is
 * `archive:<teamMembershipId>`.
 */
const archiveItemSchema = z.object({
    kind: z.literal("archive"),
    itemId: z.string(),
    teamMembershipId: TeamMembershipId.schema,
    personId: PersonId.schema,
    personName: z.string(),
    d4hMemberId: z.number(),
});

/**
 * Non-`Deleted` D4H-linked membership whose D4H member is gone, while its person's email now
 * belongs to another D4H member (deleted and re-created in D4H): rewrite `d4hMemberId` and the
 * snapshot, reactivating the membership if it's archived. `itemId` is
 * `relink:<teamMembershipId>`.
 */
const relinkItemSchema = z.object({
    kind: z.literal("relink"),
    itemId: z.string(),
    teamMembershipId: TeamMembershipId.schema,
    personId: PersonId.schema,
    personName: z.string(),
    previousD4hMemberId: z.number(),
    d4hMemberId: z.number(),
    /** Plan-time status; an `Archived` membership is reactivated by the relink. */
    membershipStatus: z.enum(["Active", "Archived"]),
    before: membershipSnapshotSchema,
    incoming: membershipSnapshotSchema,
    changes: z.array(DiffChange.schema),
});

/**
 * The `Team_D4H` (and, for an org-bearing team, `Organization_D4H`) cache refresh. Always present,
 * with `itemId` `metadata`; `changes` is empty when nothing differs. The executor writes a field
 * only while its current value still equals `before`.
 */
const metadataItemSchema = z.object({
    kind: z.literal("metadata"),
    itemId: z.literal("metadata"),
    team: z.object({ before: teamFieldsSchema, incoming: teamFieldsSchema }),
    /** null for an org-less team. */
    organization: z.object({ before: storedOrgFieldsSchema, incoming: orgFieldsSchema }).nullable(),
    /** Flat diff over both, the org fields keyed `org…` (`orgName`, `orgTimezone`, …) — for display. */
    changes: z.array(DiffChange.schema),
});

const d4hSyncItemSchema = z.discriminatedUnion("kind", [
    addItemSchema,
    updateItemSchema,
    reactivateItemSchema,
    archiveItemSchema,
    relinkItemSchema,
    metadataItemSchema,
]);

/**
 * Why a D4H member that isn't matched by id was left out of the plan:
 * - `missing-email`: bad data in D4H.
 * - `person-in-rubbish-bin`: the email belongs to a person in the Rubbish bin (#183).
 * - `duplicate-email`: several D4H members share the email, so it can't pick a person (#144).
 * - `membership-in-rubbish-bin`: the person's membership on this team is in the Rubbish bin.
 * - `linked-to-another-member`: the person's membership on this team is linked to a different
 *   D4H member who is still in D4H.
 */
const d4hSyncSkipReasonSchema = z.enum([
    "missing-email",
    "person-in-rubbish-bin",
    "duplicate-email",
    "membership-in-rubbish-bin",
    "linked-to-another-member",
]);

const d4hSyncPlanSchema = z.object({
    d4hTeamId: z.number(),
    /** In execution order: add, relink, update, reactivate, archive, metadata. */
    items: z.array(d4hSyncItemSchema),
    skipped: z.array(
        z.object({
            d4hMemberId: z.number(),
            name: z.string(),
            reason: d4hSyncSkipReasonSchema,
        }),
    ),
    counts: z.object({
        additions: z.number(),
        relinks: z.number(),
        updates: z.number(),
        reactivations: z.number(),
        archivals: z.number(),
        skipped: z.number(),
    }),
});

export const D4HSyncPlan = {
    schema: d4hSyncPlanSchema,
    itemSchema: d4hSyncItemSchema,
    skipReasonSchema: d4hSyncSkipReasonSchema,
} as const;

export type D4HSyncPlan = z.infer<typeof d4hSyncPlanSchema>;
export type D4HSyncItem = z.infer<typeof d4hSyncItemSchema>;
/** An item as the builder assembles it, with plain-string ids, before parsing applies the brands. */
export type D4HSyncItemDraft = z.input<typeof d4hSyncItemSchema>;
export type D4HSyncSkipReason = z.infer<typeof d4hSyncSkipReasonSchema>;

/**
 * Why the executor found a `skipped-changed` item no longer applied:
 * - `already-linked`: another membership on the team is already linked to the D4H member.
 * - `person-in-rubbish-bin`: the person with the email is in the Rubbish bin.
 * - `membership-in-rubbish-bin`: the team membership is in the Rubbish bin.
 * - `linked-to-another-member`: the person's membership is linked to a different D4H member.
 * - `membership-missing`: the team membership no longer exists.
 * - `d4h-member-changed`: the membership is now linked to a different D4H member than planned.
 * - `details-changed`: the stored D4H details no longer equal the plan's `before`.
 * - `not-archived` / `not-active`: the membership's status moved under the plan.
 * - `fields-changed`: every metadata field the plan changes was edited under it.
 */
const d4hSyncChangedReasonSchema = z.enum([
    "already-linked",
    "person-in-rubbish-bin",
    "membership-in-rubbish-bin",
    "linked-to-another-member",
    "membership-missing",
    "d4h-member-changed",
    "details-changed",
    "not-archived",
    "not-active",
    "fields-changed",
]);

export type D4HSyncChangedReason = z.infer<typeof d4hSyncChangedReasonSchema>;

/** The outcome of executing one plan item, stored in the plan row's `outcomes`. */
const d4hSyncItemOutcomeSchema = z.object({
    itemId: z.string(),
    result: z.enum(["applied", "skipped-by-user", "skipped-changed"]),
    /** Why a `skipped-changed` item no longer applied. */
    reason: d4hSyncChangedReasonSchema.optional(),
    /** Metadata fields left alone because they changed under the plan. */
    skippedFields: z.array(z.string()).optional(),
});

export const D4HSyncItemOutcome = {
    schema: d4hSyncItemOutcomeSchema,
    reasonSchema: d4hSyncChangedReasonSchema,
} as const;

export type D4HSyncItemOutcome = z.infer<typeof d4hSyncItemOutcomeSchema>;

/** True when the plan would change nothing: no items besides a metadata item with no changes. */
export function isD4HSyncPlanEmpty(plan: D4HSyncPlan): boolean {
    return plan.items.every((item) => item.kind === "metadata" && item.changes.length === 0);
}
