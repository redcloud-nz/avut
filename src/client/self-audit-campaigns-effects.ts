/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { SelfAuditCampaignId } from "@/lib/schemas/self-audit";
import { trpc } from "@/trpc/client";
import { createEffects, invalidate } from "@/trpc/mutation-effector";

/**
 * The list's counts, the campaign's members, and who's left to add, after a member change. Who's
 * left to add is a D4H read, so it's only marked stale: the add dialog closes on success, and its
 * picker reads afresh when next opened, rather than D4H being read again as it closes.
 */
function campaignChanged(organizationId: string, campaignId: SelfAuditCampaignId) {
    return [
        invalidate(trpc.selfAuditCampaigns.listCampaigns.queryFilter({ organizationId })),
        invalidate(trpc.selfAuditCampaigns.getCampaign.queryFilter({ organizationId, campaignId })),
        invalidate(
            trpc.selfAuditCampaigns.listAddableMembers.queryFilter({ organizationId, campaignId }),
            { refetch: false },
        ),
    ];
}

/**
 * Cache effects for `selfAuditCampaigns` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const selfAuditCampaignsEffects = createEffects<"selfAuditCampaigns">()({
    addMembers: ({ organizationId }, { campaignId }) => campaignChanged(organizationId, campaignId),
    // D4H changed (items marked LOST or created) and tasks were queued, so the differences, the
    // task lists and the equipment views are all stale. Mirrors `d4h-tasks-effects.ts`.
    applyFixes: ({ organizationId }, { campaignId }) => [
        invalidate(
            trpc.selfAuditCampaigns.listDifferences.queryFilter({ organizationId, campaignId }),
        ),
        invalidate(trpc.d4hTasks.listOpenTasks.queryFilter({ organizationId })),
        invalidate(trpc.d4hTasks.listItemTasks.queryFilter({ organizationId })),
        // Each task carries the request's form instance.
        invalidate(trpc.forms.listFormInstanceTasks.queryFilter({ organizationId })),
        invalidate(trpc.d4hApi.getEquipmentItem.queryFilter({ organizationId })),
        invalidate(trpc.d4hApi.listMemberEquipment.queryFilter({ organizationId })),
        invalidate(trpc.d4hApi.listTeamIssuedEquipment.queryFilter({ organizationId })),
        invalidate(trpc.d4hApi.listEquipmentKindItems.queryFilter({ organizationId })),
        invalidate(trpc.d4hApi.listEquipmentItemContents.queryFilter({ organizationId })),
    ],
    // The new Draft joins the list. Its page isn't cached yet, but any entry for it is refetched.
    createCampaign: ({ organizationId }, { campaignId }) => [
        invalidate(trpc.selfAuditCampaigns.listCampaigns.queryFilter({ organizationId })),
        invalidate(trpc.selfAuditCampaigns.getCampaign.queryFilter({ organizationId, campaignId })),
    ],
    // Gone from the list; its page navigates away (`meta.navigates`).
    discardCampaign: ({ organizationId }, { campaignId }) =>
        campaignChanged(organizationId, campaignId),
    removeRequest: ({ organizationId }, { campaignId }) =>
        campaignChanged(organizationId, campaignId),
    // The request's delivery changes, and with it the campaign's counts.
    resendRequest: ({ organizationId }, { campaignId }) => [
        invalidate(trpc.selfAuditCampaigns.listCampaigns.queryFilter({ organizationId })),
        invalidate(trpc.selfAuditCampaigns.getCampaign.queryFilter({ organizationId, campaignId })),
    ],
    // The campaign is no longer a Draft, and every member's delivery changes.
    sendCampaign: ({ organizationId }, { campaignId }) => [
        invalidate(trpc.selfAuditCampaigns.listCampaigns.queryFilter({ organizationId })),
        invalidate(trpc.selfAuditCampaigns.getCampaign.queryFilter({ organizationId, campaignId })),
    ],
    // The member's link dies and they become re-addable.
    withdrawRequest: ({ organizationId }, { campaignId }) =>
        campaignChanged(organizationId, campaignId),
});
