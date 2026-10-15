/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/teams/[team_id]/history
 */

import { Metadata } from "next";

import { AdminModule_TeamHistory_Content } from "@/components/admin/teams/team-history-content";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { TeamId } from "@/lib/schemas/team";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { fetchQuery, HydrateClient, prefetch, prefetchInfinite, trpc } from "@/trpc/server";

type Props = PageProps<`/orgs/[slug]/admin/teams/[team_id]/history`>;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, team_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const teamId = TeamId.schema.parse(team_id);
    const team = await fetchQuery(
        trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }),
    );

    return {
        title: `${team.name} History ${TITLE_SEPARATOR} Teams`,
    };
}

export default async function AdminModule_TeamHistory_Page(props: Props) {
    const { slug, team_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const teamId = TeamId.schema.parse(team_id);

    prefetch(trpc.teams.getTeam.queryOptions({ organizationId: organization.id, teamId }));
    // Same input as `ObjectHistory`'s client query (no `limit`), so the keys match.
    prefetchInfinite(
        trpc.history.listObjectHistory.infiniteQueryOptions(
            { organizationId: organization.id, objectType: "Team", objectId: teamId },
            { getNextPageParam: (page) => page.nextCursor ?? undefined },
        ),
    );

    return (
        <HydrateClient>
            <AdminModule_TeamHistory_Content teamId={teamId} />
        </HydrateClient>
    );
}
