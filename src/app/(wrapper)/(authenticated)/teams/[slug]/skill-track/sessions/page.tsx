/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /teams/[slug]/skill-track/sessions
 */

import { Std } from "@/components/blocks/std";
import { TITLE_SEPARATOR } from "@/lib/constants";
import SkillTrack_Sessions_List from "@/modules/skill-track/components/sessions-list";
import { requireTeam } from "@/server/team-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Skill Check Sessions ${TITLE_SEPARATOR} Skills Module`,
};

export default async function Team_SkillTrack_Sessions_Page(
    props: PageProps<"/teams/[slug]/skill-track/sessions">,
) {
    const { slug } = await props.params;
    // Cached per request, and already run by the team layout. Read here for the ids.
    const { organization, team } = await requireTeam(slug);

    prefetch(
        trpc.skillCheckSessions.listSessions.queryOptions({
            organizationId: organization.id,
            teamId: team.id,
        }),
    );

    return (
        <HydrateClient>
            <Std.ScrollContainer>
                <SkillTrack_Sessions_List teamId={team.id} />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
