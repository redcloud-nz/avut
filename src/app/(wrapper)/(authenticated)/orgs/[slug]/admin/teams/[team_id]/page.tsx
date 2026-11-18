/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/teams/[team_id]
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { hasAnyRoleWithPermissions } from "@/lib/permissions";
import { TeamId } from "@/lib/schemas/team";
import { AdminModule_Team_Content } from "@/modules/org-admin/components/teams/team-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/admin/teams/[team_id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, team_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const teamId = TeamId.schema.parse(team_id);
    const team = await fetchQuery(
        trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }),
    );

    return {
        title: `${team.name} ${TITLE_SEPARATOR} Teams`,
    };
}

export default async function AdminModule_Team_Page(props: Props) {
    const { slug, team_id } = await props.params;
    // Cached per request, and already loaded by the org layout. Only for the roles here: it
    // guards nothing, since `listTeamUsers` checks `member: ["view"]` itself.
    const { organization, roles } = await requireOrganization(slug);

    const teamId = TeamId.schema.parse(team_id);

    prefetch(trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }));
    // The Access card shows only behind `member: ["view"]`. Without it the prefetch would fail
    // FORBIDDEN on every visit, for a query nothing on the page reads.
    if (hasAnyRoleWithPermissions(roles, { member: ["view"] })) {
        prefetch(
            trpc.teamUsers.listTeamUsers.queryOptions({ organizationId: organization.id, teamId }),
        );
    }

    return (
        <HydrateClient>
            <AdminModule_Team_Content teamId={teamId} />
        </HydrateClient>
    );
}
