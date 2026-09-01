/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { createEffects, invalidate } from "@/trpc/mutation-effector";
import { trpc } from "@/trpc/client";

/**
 * Cache effects for `systemAdmin` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `MutationInvalidator`.
 */
export const systemAdminEffects = createEffects<"systemAdmin">()({
    addOrganizationMember: (vars) => [
        invalidate(
            trpc.systemAdmin.getOrganization.queryFilter({ organizationId: vars.organizationId }),
        ),
        invalidate(trpc.systemAdmin.listOrganizations.queryFilter()),
        invalidate(trpc.systemAdmin.getUser.queryFilter({ userId: vars.userId })),
    ],
    createOrganization: () => [invalidate(trpc.systemAdmin.listOrganizations.queryFilter())],
    deleteUser: () => [
        invalidate(trpc.systemAdmin.listUsers.queryFilter()),
        invalidate(trpc.systemAdmin.listOrganizations.queryFilter()),
        invalidate(trpc.systemAdmin.getOrganization.queryFilter()),
    ],
    removeOrganizationMember: (vars) => [
        invalidate(
            trpc.systemAdmin.getOrganization.queryFilter({ organizationId: vars.organizationId }),
        ),
        invalidate(trpc.systemAdmin.listOrganizations.queryFilter()),
        invalidate(trpc.systemAdmin.getUser.queryFilter({ userId: vars.userId })),
    ],
    setOrganizationMemberRole: (vars) => [
        invalidate(
            trpc.systemAdmin.getOrganization.queryFilter({ organizationId: vars.organizationId }),
        ),
        invalidate(trpc.systemAdmin.listOrganizations.queryFilter()),
        invalidate(trpc.systemAdmin.getUser.queryFilter({ userId: vars.userId })),
    ],
    setUserRole: (vars) => [
        invalidate(trpc.systemAdmin.listUsers.queryFilter()),
        invalidate(trpc.systemAdmin.getUser.queryFilter({ userId: vars.userId })),
    ],
});
