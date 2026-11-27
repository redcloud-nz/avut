/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate } from "@/trpc/mutation-effector";

/**
 * Cache effects for `selfAuditCampaigns` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const selfAuditCampaignsEffects = createEffects<"selfAuditCampaigns">()({
    // The new check joins the list. Its page isn't cached yet, but the send updates every
    // request's delivery, so any entry for it is refetched.
    createCampaign: ({ organizationId }, { campaignId }) => [
        invalidate(trpc.selfAuditCampaigns.listCampaigns.queryFilter({ organizationId })),
        invalidate(trpc.selfAuditCampaigns.getCampaign.queryFilter({ organizationId, campaignId })),
    ],
    // The request's delivery changes, and with it the check's counts.
    resendRequest: ({ organizationId }, { campaignId }) => [
        invalidate(trpc.selfAuditCampaigns.listCampaigns.queryFilter({ organizationId })),
        invalidate(trpc.selfAuditCampaigns.getCampaign.queryFilter({ organizationId, campaignId })),
    ],
});
