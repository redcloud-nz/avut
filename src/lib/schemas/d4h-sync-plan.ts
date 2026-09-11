/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

import { DiffChange } from "@/lib/diff";

import { D4HMemberStatus } from "./d4h/member";
import { TeamId } from "./team";
import { TeamMembershipId } from "./team-membership";

/**
 * The preview of a manual D4H team sync, produced by the pure `buildSyncPlan`
 * (`src/server/d4h-sync.ts`). Rendered by the sync dialog; the exact same plan is
 * recomputed server-side at apply time and matched against `planToken`.
 *
 * Deviates from spec §7.3: memberships that leave D4H are **archived, not
 * deleted**, so `removals` is replaced by `archivals` + `reactivations`.
 */
const syncPlanSchema = z.object({
    teamId: TeamId.schema,
    generatedAt: z.iso.datetime(),
    /** sha256 of the normalised D4H input — a stale token forces a re-preview. */
    planToken: z.string(),

    /** D4H member with no D4H-managed AVUT membership yet. */
    additions: z.array(
        z.object({
            d4hMemberId: z.number(),
            name: z.string(),
            email: z.string(),
            status: D4HMemberStatus.schema,
            personMatch: z.enum(["existing", "new"]),
            /** A manual membership already joins this person to the team; apply adopts it. */
            adoptsMembership: z.boolean(),
        }),
    ),

    /** Active D4H-managed membership whose snapshot fields changed in D4H. */
    updates: z.array(
        z.object({
            teamMembershipId: TeamMembershipId.schema,
            d4hMemberId: z.number(),
            personName: z.string(),
            changes: z.array(DiffChange.schema),
        }),
    ),

    /** Active D4H-managed membership whose member is no longer in D4H. */
    archivals: z.array(
        z.object({
            teamMembershipId: TeamMembershipId.schema,
            personName: z.string(),
        }),
    ),

    /** Archived D4H-managed membership whose member reappeared in D4H. */
    reactivations: z.array(
        z.object({
            teamMembershipId: TeamMembershipId.schema,
            d4hMemberId: z.number(),
            personName: z.string(),
            changes: z.array(DiffChange.schema),
        }),
    ),

    /** Diff over `Team_D4H` (and, for an org-bearing team, `Organization_D4H`) cache fields. */
    teamMetadataChanges: z.array(DiffChange.schema),

    counts: z.object({
        additions: z.number(),
        updates: z.number(),
        archivals: z.number(),
        reactivations: z.number(),
    }),
});

export const SyncPlan = {
    schema: syncPlanSchema,
} as const;

export type SyncPlan = z.infer<typeof syncPlanSchema>;

/** True when the plan would change nothing. */
export function isSyncPlanEmpty(plan: SyncPlan): boolean {
    return (
        plan.counts.additions === 0 &&
        plan.counts.updates === 0 &&
        plan.counts.archivals === 0 &&
        plan.counts.reactivations === 0 &&
        plan.teamMetadataChanges.length === 0
    );
}
