/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /teams/[slug]/admin
 */

import { Metadata } from "next";

import { hasAnyRoleWithPermissions } from "@/lib/permissions";
import { TeamAdmin_Overview_Content } from "@/modules/team-admin/components/team-admin-content";
import { requireTeam } from "@/server/team-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

// The team layout's title template adds the team's name.
export const metadata: Metadata = { title: "Admin" };

export default async function TeamAdmin_Overview_Page(props: PageProps<"/teams/[slug]/admin">) {
    const { slug } = await props.params;
    // Cached per request, and already run by the team layout. Read here for the ids and roles;
    // it guards nothing, since `getTeam` checks `team: ["view"]` itself.
    const { organization, team, roles } = await requireTeam(slug);
    const ids = { organizationId: organization.id, teamId: team.id };

    prefetch(trpc.teams.getTeam.queryOptions(ids));
    prefetch(trpc.teams.listTeamMemberships.queryOptions(ids));
    // The Access card shows only behind `member: ["view"]`. Without it the prefetch would fail
    // FORBIDDEN on every visit, for a query nothing on the page reads.
    if (hasAnyRoleWithPermissions(roles, { member: ["view"] })) {
        prefetch(trpc.teamUsers.listTeamUsers.queryOptions(ids));
    }

    return (
        <HydrateClient>
            <TeamAdmin_Overview_Content />
        </HydrateClient>
    );
}
