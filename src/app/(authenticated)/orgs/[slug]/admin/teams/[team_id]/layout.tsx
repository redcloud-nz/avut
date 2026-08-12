/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/teams/[team_id]
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { TeamId } from "@/lib/schemas/team";
import { requireOrganization } from "@/server/organization-access";
import { getServerQueryClient, trpc } from "@/trpc/server";

// Reads through the same query options the page prefetches, so metadata and the page cost
// one database round trip between them. Unlike the previous unchecked lookup this runs the
// procedure's permission check and can therefore raise `forbidden()` — which is correct,
// and renders the same panel the layout's own guard would.
export async function generateMetadata(
    props: LayoutProps<`/orgs/[slug]/admin/teams/[team_id]`>,
): Promise<Metadata> {
    const { slug, team_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const team = await getServerQueryClient().fetchQuery(
        trpc.teams.getTeam.queryOptions({
            organizationId: organization.id,
            teamId: TeamId.schema.parse(team_id),
        }),
    );

    return {
        title: `${team.name} ${TITLE_SEPARATOR} Teams`,
    };
}

export default async function AdminModule_Team_Layout(
    props: LayoutProps<`/orgs/[slug]/admin/teams/[team_id]`>,
) {
    const { slug } = await props.params;
    await requireOrganization(slug);

    return <>{props.children}</>;
}
