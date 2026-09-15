/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { createEffects, invalidate, write } from "@/trpc/mutation-effector";
import { trpc } from "@/trpc/client";

/**
 * Cache effects for `teams` router mutations, keyed by procedure name.
 *
 * Passed as `meta.effects` on the corresponding `useMutation` call — see `useMutationEffector`.
 */
const teamCaches = (vars: { organizationId: string; teamId: string }) => [
    invalidate(trpc.teams.listTeams.queryFilter({ organizationId: vars.organizationId })),
    invalidate(
        trpc.teams.getTeam.queryFilter({
            organizationId: vars.organizationId,
            teamId: vars.teamId,
        }),
    ),
    invalidate(
        trpc.teams.listTeamMemberships.queryFilter({
            organizationId: vars.organizationId,
            teamId: vars.teamId,
        }),
    ),
    // D4H team link/unlink/sync also creates, drops, or refreshes the org-level
    // `Organization_D4H` row and its cached metadata.
    invalidate(trpc.teams.getOrganizationD4H.queryFilter({ organizationId: vars.organizationId })),
];

export const teamsEffects = createEffects<"teams">()({
    applyD4HTeamSync: (vars) => teamCaches(vars),
    createTeam: (vars) => [
        invalidate(trpc.teams.listTeams.queryFilter({ organizationId: vars.organizationId })),
    ],
    linkTeamToD4H: (vars) => teamCaches(vars),
    unlinkTeamFromD4H: (vars) => teamCaches(vars),
    syncOrganizationD4H: (vars) => [
        invalidate(
            trpc.teams.getOrganizationD4H.queryFilter({ organizationId: vars.organizationId }),
        ),
    ],
    unlinkOrganizationFromD4H: (vars) => [
        invalidate(
            trpc.teams.getOrganizationD4H.queryFilter({ organizationId: vars.organizationId }),
        ),
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
