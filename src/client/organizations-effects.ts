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
 * The membership mutations (`allowSystemAdmin`) were originally only called from the
 * system-administration console, so they invalidate this router's own
 * `getOrganizationAsAdmin`/`listOrganizations` and `users.getUser` queries.
 * `removeOrganizationMember`/`setOrganizationMemberRole` are now also called from the org-admin
 * users pages (`update-user.tsx`/`delete-user.tsx`), which read the member list via
 * `listMembers`.
 */
/**
 * A single-role grant/revoke (`grantMemberRole`/`revokeMemberRole`) changes the member's roles
 * as `setOrganizationMemberRole` does, and also who can be picked as a session assessor.
 */
function memberRoleGrantEffects(vars: { organizationId: string; userId: string }) {
    return [
        invalidate(
            trpc.organizations.listMembersForRoleGrant.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
        invalidate(
            trpc.organizations.listMembers.queryFilter({ organizationId: vars.organizationId }),
        ),
        invalidate(trpc.users.getUser.queryFilter({ userId: vars.userId })),
        invalidate(
            trpc.organizations.getMyRoles.queryFilter({ organizationId: vars.organizationId }),
        ),
        invalidate(
            trpc.skillCheckSessions.listEligibleAssessors.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
    ];
}

export const organizationsEffects = createEffects<"organizations">()({
    addOrganizationMember: (vars) => [
        invalidate(
            trpc.organizations.getOrganizationAsAdmin.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
        invalidate(trpc.organizations.listOrganizations.queryFilter()),
        invalidate(trpc.users.getUser.queryFilter({ userId: vars.userId })),
        invalidate(
            trpc.organizations.listMembers.queryFilter({ organizationId: vars.organizationId }),
        ),
    ],
    createOrganization: () => [invalidate(trpc.organizations.listOrganizations.queryFilter())],
    grantMemberRole: (vars) => memberRoleGrantEffects(vars),
    makeOwner: (vars) => [
        invalidate(
            trpc.organizations.getOrganizationAsAdmin.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
        invalidate(trpc.organizations.listOrganizations.queryFilter()),
        invalidate(trpc.users.getUser.queryFilter({ userId: vars.userId })),
        invalidate(
            trpc.organizations.listMembers.queryFilter({ organizationId: vars.organizationId }),
        ),
    ],
    removeOrganizationMember: (vars) => [
        invalidate(
            trpc.organizations.getOrganizationAsAdmin.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
        invalidate(trpc.organizations.listOrganizations.queryFilter()),
        invalidate(trpc.users.getUser.queryFilter({ userId: vars.userId })),
        invalidate(
            trpc.organizations.listMembers.queryFilter({ organizationId: vars.organizationId }),
        ),
    ],
    removeOwner: (vars) => [
        invalidate(
            trpc.organizations.getOrganizationAsAdmin.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
        invalidate(trpc.organizations.listOrganizations.queryFilter()),
        invalidate(trpc.users.getUser.queryFilter({ userId: vars.userId })),
        invalidate(
            trpc.organizations.listMembers.queryFilter({ organizationId: vars.organizationId }),
        ),
    ],
    revokeMemberRole: (vars) => memberRoleGrantEffects(vars),
    setOrganizationMemberRole: (vars) => [
        invalidate(
            trpc.organizations.getOrganizationAsAdmin.queryFilter({
                organizationId: vars.organizationId,
            }),
        ),
        invalidate(trpc.organizations.listOrganizations.queryFilter()),
        invalidate(trpc.users.getUser.queryFilter({ userId: vars.userId })),
        invalidate(
            trpc.organizations.listMembers.queryFilter({ organizationId: vars.organizationId }),
        ),
    ],
});
