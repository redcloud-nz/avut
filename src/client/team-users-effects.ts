/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import { createEffects, invalidate } from "@/trpc/mutation-effector";

/** A grant or revoke changes the team's list of users and the user's list of teams. */
function grantCaches(vars: { organizationId: string; teamId: string; userId: string }) {
    return [
        invalidate(
            trpc.teamUsers.listTeamUsers.queryFilter({
                organizationId: vars.organizationId,
                teamId: vars.teamId,
            }),
        ),
        invalidate(
            trpc.teamUsers.listUserTeams.queryFilter({
                organizationId: vars.organizationId,
                userId: vars.userId,
            }),
        ),
    ];
}

/**
 * Cache effects for `teamUsers` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
export const teamUsersEffects = createEffects<"teamUsers">()({
    grantTeamAccess: (vars) => grantCaches(vars),
    revokeTeamAccess: (vars) => grantCaches(vars),
});
