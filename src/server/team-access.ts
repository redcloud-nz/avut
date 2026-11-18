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
import type { TeamScopeTeamData } from "@/lib/schemas/team-scope";
import { UserId } from "@/lib/schemas/user";

import type { AuthSession } from "./auth";
import { getOrganizationBySlug } from "./cache/organization";
import { getOrganizationSettings } from "./cache/organization-settings";
import { getOrganizationUserRoles } from "./cache/organization-user";
import prisma from "./prisma";
import * as Teams from "./services/teams";
import { requireSession } from "./session";

export interface TeamAccess {
    session: AuthSession;
    team: TeamScopeTeamData;
    organization: OrganizationData;
    settings: OrganizationSettings;
    roles: Role[];
}

/**
 * Resolve a team by slug for the team scope, verifying that the current user is signed in and
 * holds a `TeamUser` grant on it (`Teams.getGrantedBySlug`: an unknown slug, a non-Active team and
 * an ungranted caller all get not-found). Returns the session, the team, and the team's
 * organization, settings and the caller's roles in it, so the team layout can seed both the team
 * and the org queries from one call.
 *
 * Cached per request on the slug alone, like `requireOrganization`. It's for a correct first
 * response and the shell's data, not a guard: team-scope reads are checked by `teamProcedure`.
 *
 * Round trips: the grant check is one query. The org, settings and roles come from the `"use cache"`
 * org helpers, keyed on the org the team belongs to, and are fetched concurrently.
 */
export const requireTeam = cache(async (slug: string): Promise<TeamAccess> => {
    const session = await requireSession();

    const userId = UserId.schema.parse(session.user.id);

    const team = await Teams.getGrantedBySlug(prisma, slug, userId);
    if (!team) return notFound();

    const [organization, settings, roles] = await Promise.all([
        getOrganizationBySlug(team.organization.slug),
        getOrganizationSettings(team.organization.id),
        getOrganizationUserRoles(team.organization.id, userId),
    ]);

    return { session, team, organization, settings, roles };
});
