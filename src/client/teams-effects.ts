/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { invalidate, write } from "@/trpc/mutation-invalidator";
import { trpc } from "@/trpc/client";
import type { RouterInput, RouterOutput } from "@/trpc/routers/_app";

/**
 * Cache effects for `teams` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `MutationInvalidator`.
 */
export const teamsEffects = {
    createTeam: (vars: RouterInput["teams"]["createTeam"]) => [
        invalidate(trpc.teams.listTeams.queryFilter({ organizationId: vars.organizationId })),
    ],
    createTeamMembership: (vars: RouterInput["teams"]["createTeamMembership"]) => [
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
    deleteTeamMembership: (vars: RouterInput["teams"]["deleteTeamMembership"]) => [
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
    updateTeam: (
        vars: RouterInput["teams"]["updateTeam"],
        { updated }: RouterOutput["teams"]["updateTeam"],
    ) => [
        write(
            trpc.teams.getTeam.queryKey({
                organizationId: vars.organizationId,
                teamId: vars.teamId,
            }),
            updated,
        ),
        invalidate(trpc.teams.listTeams.queryFilter({ organizationId: vars.organizationId })),
    ],
};
