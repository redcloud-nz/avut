/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

import { NotFoundError } from "@/lib/errors";
import { TeamData, type TeamId } from "@/lib/schemas/team";

import type { OrgServiceContext } from "./service-context";

/**
 * Fetch a team by ID, or `null` if it does not exist within the organization. Callers that need
 * the team to exist should use `requireById` instead.
 */
export async function getById(ctx: OrgServiceContext, teamId: TeamId): Promise<TeamData | null> {
    const team = await ctx.prisma.team.findUnique({
        where: {
            id: teamId,
            organizationId: ctx.organizationId,
        },
        include: {
            d4h: true,
        },
    });

    if (!team) return null;

    // Resolve the D4H organisation name from the org-level cache (at most one
    // `Organization_D4H` per org) so the detail view can show it alongside the id.
    const orgD4H = team.d4h
        ? await ctx.prisma.organization_D4H.findUnique({
              where: { organizationId: ctx.organizationId },
              select: { d4hOrganisationName: true },
          })
        : null;

    return TeamData.fromRecord({
        ...team,
        d4h: team.d4h
            ? { ...team.d4h, d4hOrganisationName: orgD4H?.d4hOrganisationName ?? null }
            : null,
    });
}

/**
 * Fetch a team by ID and ensure it belongs to the organization.
 * @throws NotFoundError if the team does not exist within the organization.
 */
export async function requireById(ctx: OrgServiceContext, teamId: TeamId): Promise<TeamData> {
    const team = await getById(ctx, teamId);

    if (!team) {
        throw new NotFoundError(`Team(id=${teamId}) not found.`);
    }

    return team;
}
