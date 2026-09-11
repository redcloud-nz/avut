/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/teams/[team_id]/personnel/[person_id]
 */

import { Metadata } from "next";

import { AdminModule_TeamMembership_Content } from "@/components/admin/teams/team-membership-content";
import { Std } from "@/components/blocks/std";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { PersonId } from "@/lib/schemas/person";
import { TeamId } from "@/lib/schemas/team";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/admin/teams/[team_id]/personnel/[person_id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, team_id, person_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const teamId = TeamId.schema.parse(team_id);
    const personId = PersonId.schema.parse(person_id);

    const membership = await fetchQuery(
        trpc.teams.getTeamMembership.queryOptions({
            organizationId: organization.id,
            teamId,
            personId,
        }),
    );

    return {
        title: `${membership.person.name} ${TITLE_SEPARATOR} ${membership.team.name}`,
    };
}

export default async function AdminModule_TeamMembership_Page(props: Props) {
    const { slug, team_id, person_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const teamId = TeamId.schema.parse(team_id);
    const personId = PersonId.schema.parse(person_id);

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
            <Std.SidebarInset>
                <AdminModule_TeamMembership_Content teamId={teamId} personId={personId} />
            </Std.SidebarInset>
        </HydrateClient>
    );
}
