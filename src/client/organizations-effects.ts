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
 * The membership mutations (`allowSystemAdmin`) were originally only called from the system-admin
 * console, so they invalidate `systemAdmin`'s own org/user queries. `removeOrganizationMember`/
 * `setOrganizationMemberRole` are now also called from the org-admin users pages
 * (`update-user.tsx`/`delete-user.tsx`), which read the member list via `listMembers`.
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
        invalidate(
            trpc.organizations.listMembers.queryFilter({ organizationId: vars.organizationId }),
        ),
    ],
    setOrganizationMemberRole: (vars) => [
        invalidate(
            trpc.systemAdmin.getOrganization.queryFilter({ organizationId: vars.organizationId }),
        ),
        invalidate(trpc.systemAdmin.listOrganizations.queryFilter()),
        invalidate(trpc.systemAdmin.getUser.queryFilter({ userId: vars.userId })),
        invalidate(
            trpc.organizations.listMembers.queryFilter({ organizationId: vars.organizationId }),
        ),
    ],
});
