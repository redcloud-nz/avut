/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /teams/[slug]/skill-track/checks
 */

import { Std } from "@/components/blocks/std";
import SkillTrack_ChecksList from "@/modules/skill-track/components/checks-list";
import {
    checkSearchInput,
    loadCheckSearchParams,
} from "@/modules/skill-track/lib/check-search-params";
import { requireTeam } from "@/server/team-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: "Skill Checks",
};

export default async function Team_SkillTrack_Checks_Page(
    props: PageProps<"/teams/[slug]/skill-track/checks">,
) {
    const { slug } = await props.params;
    // Cached per request, and already run by the team layout. Read here for the ids.
    const { organization, team } = await requireTeam(slug);
    const params = await loadCheckSearchParams(props.searchParams);

    prefetch(
        trpc.skillChecks.searchChecks.queryOptions(
            checkSearchInput(organization.id, params, team.id),
        ),
    );
    // What the filters (the Session and Assessee options) and the Session column (other teams'
    // names) read in team scope.
    prefetch(
        trpc.skillCheckSessions.listSessions.queryOptions({
            organizationId: organization.id,
            teamId: team.id,
        }),
    );
    prefetch(
        trpc.teams.listTeamMemberships.queryOptions({
            organizationId: organization.id,
            teamId: team.id,
        }),
    );
    prefetch(trpc.teams.listTeams.queryOptions({ organizationId: organization.id }));

    return (
        <HydrateClient>
            <Std.ScrollContainer>
                <SkillTrack_ChecksList />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
