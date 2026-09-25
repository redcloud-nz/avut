/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate } from "@/trpc/mutation-effector";

/**
 * Cache effects for `organizations` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 * The membership mutations (`allowSystemAdmin`) are currently only called from the system-admin
 * console, so they invalidate `systemAdmin`'s own org/user queries rather than any org-scoped
 * ones — update this once the organization side calls them too.
 */
export const organizationsEffects = createEffects<"organizations">()({
    addOrganizationMember: (vars) => [
        invalidate(
            trpc.systemAdmin.getOrganization.queryFilter({ organizationId: vars.organizationId }),
        ),
        invalidate(trpc.systemAdmin.listOrganizations.queryFilter()),
        invalidate(trpc.systemAdmin.getUser.queryFilter({ userId: vars.userId })),
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
});
