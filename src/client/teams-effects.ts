/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { createEffects, invalidate, write } from "@/trpc/mutation-effector";
import { trpc } from "@/trpc/client";

/**
 * Cache effects for `teams` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `MutationInvalidator`.
 */
export const teamsEffects = createEffects<"teams">()({
    createTeam: (vars) => [
        invalidate(trpc.teams.listTeams.queryFilter({ organizationId: vars.organizationId })),
    ],
    createTeamMembership: (vars) => [
        invalidate(
            trpc.teams.listTeamMemberships.queryFilter({
                organizationId: vars.organizationId,
                teamId: vars.teamId,
            }),
        ),
        invalidate(
            trpc.teams.listTeamMemberships.queryFilter({
                organizationId: vars.organizationId,
                personId: vars.personId,
            }),
        ),
    ],
    deleteTeamMembership: (vars) => [
        invalidate(
            trpc.teams.listTeamMemberships.queryFilter({
                organizationId: vars.organizationId,
                teamId: vars.teamId,
            }),
        ),
        invalidate(
            trpc.teams.listTeamMemberships.queryFilter({
                organizationId: vars.organizationId,
                personId: vars.personId,
            }),
        ),
    ],
    updateTeam: (vars, { updated }) => [
        write(
            trpc.teams.getTeam.queryKey({
                organizationId: vars.organizationId,
                teamId: vars.teamId,
            }),
            updated,
        ),
        invalidate(trpc.teams.listTeams.queryFilter({ organizationId: vars.organizationId })),
    ],
});
