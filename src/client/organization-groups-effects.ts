/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate } from "@/trpc/mutation-effector";

/**
 * A membership write changes the group's list row (member count, overseer), its detail page, and
 * the organization's groups card. Ids come from `data`: `setMemberRole`/`revokeMember` inputs
 * carry only a `membershipId`.
 */
function membershipEffects(data: { groupId: string; organizationId: string }) {
    return [
        invalidate(trpc.organizationGroups.listGroups.queryFilter()),
        invalidate(trpc.organizationGroups.getGroup.queryFilter({ groupId: data.groupId })),
        invalidate(
            trpc.organizationGroups.listGroupsForOrganization.queryFilter({
                organizationId: data.organizationId,
            }),
        ),
    ];
}

/**
 * Cache effects for `organizationGroups` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const organizationGroupsEffects = createEffects<"organizationGroups">()({
    addMember: (_vars, data) => membershipEffects(data),
    createGroup: () => [invalidate(trpc.organizationGroups.listGroups.queryFilter())],
    deleteGroup: (_vars, data) => [
        invalidate(trpc.organizationGroups.listGroups.queryFilter()),
        invalidate(trpc.organizationGroups.getGroup.queryFilter({ groupId: data.id })),
        // The deleted group's revoked memberships cascaded away from whichever organizations
        // held them, and the result doesn't say which.
        invalidate(trpc.organizationGroups.listGroupsForOrganization.queryFilter()),
    ],
    revokeMember: (_vars, data) => membershipEffects(data),
    setMemberRole: (_vars, data) => membershipEffects(data),
    updateGroup: (_vars, data) => [
        invalidate(trpc.organizationGroups.listGroups.queryFilter()),
        invalidate(trpc.organizationGroups.getGroup.queryFilter({ groupId: data.id })),
        // Every organization's groups card shows the group's name.
        invalidate(trpc.organizationGroups.listGroupsForOrganization.queryFilter()),
    ],
});
