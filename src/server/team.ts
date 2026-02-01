/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { cacheTag, revalidateTag } from "next/cache";
import { notFound } from "next/navigation";

import { OrganizationId } from "@/lib/schemas/organization";
import { TeamData, TeamId } from "@/lib/schemas/team";

import prisma from "./prisma";

/**
 * Get a team by its ID within an organization.
 *
 * Notes:
 * - The results are cached for performance with a cache tag of `team-{teamId}`.
 * - The `teamId` parameter is not typed to allow easier integration with route parameters.
 * - If the team is not found, a 404 response is triggered.
 *
 * @param organizationId The ID of the organization.
 * @param teamId The ID of the team.
 * @returns The team data.
 */
export async function getTeamById(
    organizationId: OrganizationId,
    teamId: string,
) {
    "use cache";
    cacheTag(`team-${teamId}`);

    const team = await prisma.team.findUnique({
        where: { organizationId: organizationId, id: teamId },
    });

    if (!team) return notFound();

    return TeamData.fromRecord(team);
}

/**
 * Revalidate the cache for a team.
 * @param teamId The ID of the team.
 */
export async function revalidateTeam(teamId: TeamId) {
    revalidateTag(`team-${teamId}`, { expire: 0 });
}
