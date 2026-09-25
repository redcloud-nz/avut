/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate } from "@/trpc/mutation-effector";

/**
 * Cache effects for `user` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const userEffects = createEffects<"user">()({
    // Joining an organization adds a membership (and its activity feed) to the dashboard.
    acceptInvitation: (vars) => [
        invalidate(trpc.user.listInvitations.queryFilter()),
        invalidate(trpc.user.listMemberships.queryFilter()),
        invalidate(trpc.user.getActivityStats.queryFilter()),
        invalidate(trpc.invitations.getLanding.queryFilter({ invitationId: vars.invitationId })),
    ],

    rejectInvitation: (vars) => [
        invalidate(trpc.user.listInvitations.queryFilter()),
        invalidate(trpc.invitations.getLanding.queryFilter({ invitationId: vars.invitationId })),
    ],
});
