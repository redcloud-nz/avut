/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/teams/[team_id]
 */

import { Metadata } from "next";

import { AdminModule_Team_Content } from "@/components/admin/teams/team-content";
import { Std } from "@/components/blocks/std";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { TeamId } from "@/lib/schemas/team";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<`/orgs/[slug]/admin/teams/[team_id]`>;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, team_id } = await props.params;
    const { organization } = await requireOrganization(slug);

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
    const { organization } = await requireOrganization(slug);

    const teamId = TeamId.schema.parse(team_id);

    prefetch(trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }));

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <AdminModule_Team_Content teamId={teamId} />
            </Std.SidebarInset>
        </HydrateClient>
    );
}
