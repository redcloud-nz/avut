/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/teams/[team_id]
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { route } from "@/lib/routes";
import { TeamId } from "@/lib/schemas/team";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, trpc } from "@/trpc/server";

import { AdminModule_Team_Content } from "./content";

type Props = PageProps<`/orgs/[slug]/admin/teams/[team_id]`>;

/**
 * Resolve the route's team.
 *
 * `generateMetadata` and the page body both call this, but it costs a single round trip:
 * `requireOrganization` is React-`cache`d and `fetchQuery` writes into the request-scoped
 * query client, so the second call is a cache hit.
 */
async function resolveTeam(props: Props) {
    const { slug, team_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const team = await fetchQuery(
        trpc.teams.getTeam.queryOptions({
            organizationId: organization.id,
            teamId: TeamId.schema.parse(team_id),
        }),
    );

    return { slug, team };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { team } = await resolveTeam(props);

    return {
        title: `${team.name} ${TITLE_SEPARATOR} Teams`,
    };
}

export default async function AdminModule_Team_Page(props: Props) {
    const { slug, team } = await resolveTeam(props);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                    { label: "Teams", href: route("/orgs/[slug]/admin/teams", { slug }) },
                    { label: team.name },
                ]}
            />
            <Std.ScrollContainer>
                <AdminModule_Team_Content team={team} />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
