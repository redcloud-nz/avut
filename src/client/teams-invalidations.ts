/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { trpc } from "@/trpc/client";
import type { RouterInput } from "@/trpc/routers/_app";

/**
 * Cache invalidations for `teams` router mutations, keyed by procedure name.
 *
 * Passed as `meta.invalidates` on the corresponding `useMutation` call — see
 * `MutationInvalidator`.
 */
export const teamsInvalidations = {
    createTeam: (vars: RouterInput["teams"]["createTeam"]) => [
        trpc.teams.listTeams.queryFilter({ organizationId: vars.organizationId }),
    ],
    createTeamMembership: (vars: RouterInput["teams"]["createTeamMembership"]) => [
        trpc.teams.listTeamMemberships.queryFilter({
            organizationId: vars.organizationId,
            teamId: vars.teamId,
        }),
        trpc.teams.listTeamMemberships.queryFilter({
            organizationId: vars.organizationId,
            personId: vars.personId,
        }),
    ],
    deleteTeamMembership: (vars: RouterInput["teams"]["deleteTeamMembership"]) => [
        trpc.teams.listTeamMemberships.queryFilter({
            organizationId: vars.organizationId,
            teamId: vars.teamId,
        }),
        trpc.teams.listTeamMemberships.queryFilter({
            organizationId: vars.organizationId,
            personId: vars.personId,
        }),
    ],
    updateTeam: (vars: RouterInput["teams"]["updateTeam"]) => [
        trpc.teams.listTeams.queryFilter({ organizationId: vars.organizationId }),
    ],
};
