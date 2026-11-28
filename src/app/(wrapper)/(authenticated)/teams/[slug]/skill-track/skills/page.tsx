/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /teams/[slug]/skill-track/skills
 */

import { Std } from "@/components/blocks/std";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillTrack_SkillsList } from "@/modules/skill-track/components/skills-list";
import { requireTeam } from "@/server/team-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Skills ${TITLE_SEPARATOR} Skill Track`,
};

export default async function Team_SkillTrack_Skills_Page(
    props: PageProps<"/teams/[slug]/skill-track/skills">,
) {
    const { slug } = await props.params;
    // Cached per request, and already run by the team layout. Read here for the ids.
    const { organization } = await requireTeam(slug);

    prefetch(
        trpc.skillPackageSubscriptions.listAssessableSkills.queryOptions({
            organizationId: organization.id,
        }),
    );

    return (
        <HydrateClient>
            <Std.ScrollContainer>
                <SkillTrack_SkillsList />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
