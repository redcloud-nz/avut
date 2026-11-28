/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /teams/[slug]/skill-track/skills/[skill_id]
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillId } from "@/lib/schemas/skill";
import { SkillTrack_Skill_Content } from "@/modules/skill-track/components/skill-content";
import { getTeamBySlug } from "@/server/cache/team";
import { requireTeam } from "@/server/team-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/teams/[slug]/skill-track/skills/[skill_id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, skill_id } = await props.params;
    // Not `requireTeam`: metadata must not redirect, and the team layout is the entry gate.
    const { organization } = await getTeamBySlug(slug);

    const skillId = SkillId.schema.parse(skill_id);
    const skill = await fetchQuery(
        trpc.skillPackageSubscriptions.getSkill.queryOptions({
            organizationId: organization.id,
            skillId,
        }),
    );

    return { title: `${skill.name} ${TITLE_SEPARATOR} Skills` };
}

export default async function Team_SkillTrack_Skill_Page(props: Props) {
    const { slug, skill_id } = await props.params;
    // Cached per request, and already run by the team layout. Read here for the ids.
    const { organization } = await requireTeam(slug);

    const skillId = SkillId.schema.parse(skill_id);

    prefetch(
        trpc.skillPackageSubscriptions.getSkill.queryOptions({
            organizationId: organization.id,
            skillId,
        }),
    );

    return (
        <HydrateClient>
            <Std.ScrollContainer>
                <SkillTrack_Skill_Content skillId={skillId} />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
