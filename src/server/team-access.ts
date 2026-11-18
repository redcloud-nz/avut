/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { notFound } from "next/navigation";
import { cache } from "react";

import type { Role } from "@/lib/permissions";
import { OrganizationData } from "@/lib/schemas/organization";
import { OrganizationSettings } from "@/lib/schemas/organization-settings";
import { TeamData } from "@/lib/schemas/team";

import type { AuthSession } from "./auth";
import { getOrganizationSettings } from "./cache/organization-settings";
import { getOrganizationUserRoles } from "./cache/organization-user";
import { getTeamBySlug } from "./cache/team";
import prisma from "./prisma";
import { requireSession } from "./session";

export interface TeamAccess {
    session: AuthSession;
    team: TeamData;
    organization: OrganizationData;
    settings: OrganizationSettings;
    roles: Role[];
}

/**
 * The team scope's **entry gate**: resolve a team by slug and check the current user may enter
 * `/teams/[slug]`. Not-found unless the team exists, is `Active`, and the caller holds a
 * `TeamUser` grant on it (a non-member of its org also gets not-found, from
 * `getOrganizationUserRoles`). Returns the session, the team, and its organization, settings and
 * the caller's roles in it. The team layout hands the team to `TeamProvider` and seeds the rest
 * into the query cache.
 *
 * The grant is checked here, on entry, and nowhere else. Beyond the team itself, team pages read
 * through the ordinary organization procedures (`teams.listTeamMemberships`, …) with the team's
 * `organizationId` and `teamId`, and those are checked by the caller's org permissions. So the
 * grant isn't a data boundary until team-only users' org-wide permissions are narrowed (#528).
 *
 * Cached per request on the slug alone, like `requireOrganization`. Round trips: the session and
 * the team (`"use cache"`, cross-request) concurrently, then settings and roles (both
 * `"use cache"`) and the grant concurrently. The grant query is deliberately uncached, and it
 * reads the team's status and slug too: those, not the cached team's, are what gate entry, so a
 * revoked grant, an archived team or a renamed slug takes effect on the next load even if a
 * `revalidateTeam` was missed.
 * The cached status is only an early exit.
 */
export const requireTeam = cache(async (slug: string): Promise<TeamAccess> => {
    const [session, { organization, ...team }] = await Promise.all([
        requireSession(),
        getTeamBySlug(slug),
    ]);

    if (team.status !== "Active") return notFound();

    const [settings, roles, grant] = await Promise.all([
        getOrganizationSettings(organization.id),
        getOrganizationUserRoles(organization.id, session.user.id),
        prisma.teamUser.findUnique({
            where: { teamId_userId: { teamId: team.id, userId: session.user.id } },
            select: { team: { select: { status: true, slug: true } } },
        }),
    ]);

    // The slug check covers a rename whose old-slug cache entry wasn't cleared: the grant is
    // looked up by team id, so without it a stale entry would still admit under the old slug.
    if (!grant || grant.team.status !== "Active" || grant.team.slug !== slug) return notFound();

    return { session, team, organization, settings, roles };
});
