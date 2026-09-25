/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/teams/[team_id]/members
 */

import { Metadata } from "next";

import { AdminModule_TeamMembers_List } from "@/components/admin/teams/team-members-list";
import { TeamId } from "@/lib/schemas/team";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<`/orgs/[slug]/admin/teams/[team_id]/members`>;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, team_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const teamId = TeamId.schema.parse(team_id);
    const team = await fetchQuery(
        trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }),
    );

    return {
        title: `Members of Team: ${team.name}`,
        description: `View and manage the members of the team "${team.name}" in the organization "${organization.name}".`,
    };
}

export default async function AdminModule_Team_Memberships_Page(props: Props) {
    const { slug, team_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const teamId = TeamId.schema.parse(team_id);

    prefetch(trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }));
    prefetch(
        trpc.teams.listTeamMemberships.queryOptions({ organizationId: organization.id, teamId }),
    );

    return (
        <HydrateClient>
            <AdminModule_TeamMembers_List teamId={teamId} />
        </HydrateClient>
    );
}
