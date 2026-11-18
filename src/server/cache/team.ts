/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";

import { OrganizationData } from "@/lib/schemas/organization";
import { TeamData } from "@/lib/schemas/team";
import prisma from "@/server/prisma";

import { teamCacheTag } from "./team-revalidate";

/**
 * A team by its slug (unique across all orgs), with its stored D4H link and its organization, or
 * `notFound()` for an unknown slug. The team's status isn't checked: callers decide what a
 * non-Active team means.
 *
 * Cached across requests under `team-<slug>`. `revalidateTeam` (`./team-revalidate`) clears it
 * after a write to the team or its D4H link. The link's `d4hOrganisationName` isn't joined, so it
 * reads as null.
 */
export async function getTeamBySlug(
    slug: string,
): Promise<TeamData & { organization: OrganizationData }> {
    "use cache";
    cacheTag(teamCacheTag(slug));

    const record = await prisma.team.findUnique({
        where: { slug },
        include: { organization: true, d4h: true },
    });

    if (!record) return notFound();

    const { organization, ...team } = record;
    return {
        ...TeamData.fromRecord(team),
        organization: OrganizationData.fromRecord(organization),
    };
}
