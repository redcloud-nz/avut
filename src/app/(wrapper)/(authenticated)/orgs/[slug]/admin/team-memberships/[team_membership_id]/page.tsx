/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/team-memberships/[team_membership_id]
 */

import { Metadata } from "next";

import { AdminModule_TeamMembership_Content } from "@/components/admin/teams/team-membership-content";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { TeamMembershipId } from "@/lib/schemas/team-membership";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/admin/team-memberships/[team_membership_id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, team_membership_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const teamMembershipId = TeamMembershipId.schema.parse(team_membership_id);

    const membership = await fetchQuery(
        trpc.teams.getTeamMembershipById.queryOptions({
            organizationId: organization.id,
            teamMembershipId,
        }),
    );

    return {
        title: `${membership.person.name} ${TITLE_SEPARATOR} ${membership.team.name}`,
    };
}

export default async function AdminModule_TeamMembershipById_Page(props: Props) {
    const { slug, team_membership_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const teamMembershipId = TeamMembershipId.schema.parse(team_membership_id);

    const membership = await fetchQuery(
        trpc.teams.getTeamMembershipById.queryOptions({
            organizationId: organization.id,
            teamMembershipId,
        }),
    );
    const { teamId, personId } = membership;

    prefetch(trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }));
    prefetch(
        trpc.teams.getTeamMembership.queryOptions({
            organizationId: organization.id,
            teamId,
            personId,
        }),
    );

    return (
        <HydrateClient>
            <AdminModule_TeamMembership_Content teamId={teamId} personId={personId} />
        </HydrateClient>
    );
}
