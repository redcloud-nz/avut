/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { SelfAuditCampaignId } from "@/lib/schemas/self-audit";
import { trpc } from "@/trpc/client";
import { createEffects, invalidate } from "@/trpc/mutation-effector";

/**
 * Cache effects for `selfAuditCampaigns` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
/** The list's counts, the campaign's members, and who's left to add, after a member change. */
function campaignChanged(organizationId: string, campaignId: SelfAuditCampaignId) {
    return [
        invalidate(trpc.selfAuditCampaigns.listCampaigns.queryFilter({ organizationId })),
        invalidate(trpc.selfAuditCampaigns.getCampaign.queryFilter({ organizationId, campaignId })),
        invalidate(
            trpc.selfAuditCampaigns.listAddableMembers.queryFilter({ organizationId, campaignId }),
        ),
    ];
}

export const selfAuditCampaignsEffects = createEffects<"selfAuditCampaigns">()({
    addMembers: ({ organizationId }, { campaignId }) => campaignChanged(organizationId, campaignId),
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
