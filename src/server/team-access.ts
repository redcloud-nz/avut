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
import { getSession, requireSession } from "./session";
import { getGrantedTeamCached } from "./team-grant";

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
 * Round trips: the grant check is one query, shared through `getGrantedTeam` with the layout's
 * `generateMetadata` and every `teamProcedure` call in the same render. The org, settings and roles
 * come from the `"use cache"` org helpers, keyed on the org the team belongs to, and are fetched
 * concurrently.
 */
export const requireTeam = cache(async (slug: string): Promise<TeamAccess> => {
    const session = await requireSession();

    const userId = UserId.schema.parse(session.user.id);

    const team = await getGrantedTeam(slug);
    if (!team) return notFound();

    const [organization, settings, roles] = await Promise.all([
        getOrganizationBySlug(team.organization.slug),
        getOrganizationSettings(team.organization.id),
        getOrganizationUserRoles(team.organization.id, userId),
    ]);

    return { session, team, organization, settings, roles };
});

/**
 * The team the current user holds a grant on by this slug, or `null` when there's no session, no
 * such Active team, or no grant. Unlike `requireTeam` it never redirects or throws, so
 * `generateMetadata` can call it (and pick `notFound()` itself).
 *
 * The session read and the grant query are both cached per request (`getSession`,
 * `getGrantedTeamCached`), so alongside `requireTeam` and `teamProcedure` it costs nothing extra.
 */
export async function getGrantedTeam(slug: string): Promise<TeamScopeTeamData | null> {
    const session = await getSession();
    if (!session) return null;

    return getGrantedTeamCached(prisma, slug, UserId.schema.parse(session.user.id));
}
