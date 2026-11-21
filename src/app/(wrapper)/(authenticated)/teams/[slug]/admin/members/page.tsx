/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /teams/[slug]/admin/members
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { TeamAdmin_Members_List } from "@/modules/team-admin/components/members-list";
import { requireTeam } from "@/server/team-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

// The team layout's title template adds the team's name.
export const metadata: Metadata = { title: "Members" };

export default async function TeamAdmin_Members_Page(
    props: PageProps<"/teams/[slug]/admin/members">,
) {
    const { slug } = await props.params;
    // Cached per request, and already run by the team layout. Read here for the ids; it guards
    // nothing, since both queries check `team: ["view"]` themselves.
    const { organization, team } = await requireTeam(slug);
    const ids = { organizationId: organization.id, teamId: team.id };

    prefetch(trpc.teams.getTeam.queryOptions(ids));
    prefetch(trpc.teams.listTeamMemberships.queryOptions(ids));

    return (
        <HydrateClient>
            <Std.ScrollContainer>
                <TeamAdmin_Members_List />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
