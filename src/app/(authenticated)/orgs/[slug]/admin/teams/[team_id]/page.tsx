/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/teams/[team_id]
 */

import { TeamId } from "@/lib/schemas/team";
import { requireOrganization } from "@/server/organization-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

import { AdminModule_Team_Content } from "./content";

export default async function AdminModule_Team_Page(
    props: PageProps<`/orgs/[slug]/admin/teams/[team_id]`>,
) {
    const { slug, team_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const teamId = TeamId.schema.parse(team_id);

    prefetch(trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }));

    return (
        <HydrateClient>
            <AdminModule_Team_Content slug={slug} teamId={teamId} />
        </HydrateClient>
    );
}
