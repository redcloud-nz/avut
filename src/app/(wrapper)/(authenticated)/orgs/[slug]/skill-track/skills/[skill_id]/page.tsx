/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/skills/[skill_id]
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillId } from "@/lib/schemas/skill";
import { SkillTrack_Skill_Content } from "@/modules/skill-track/components/skill-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/skill-track/skills/[skill_id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, skill_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const skillId = SkillId.schema.parse(skill_id);
    const skill = await fetchQuery(
        trpc.skillPackageSubscriptions.getSkill.queryOptions({
            organizationId: organization.id,
            skillId,
        }),
    );

    return { title: `${skill.name} ${TITLE_SEPARATOR} Skills` };
}

export default async function SkillTrack_Skill_Page(props: Props) {
    const { slug, skill_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const skillId = SkillId.schema.parse(skill_id);

    prefetch(
        trpc.skillPackageSubscriptions.getSkill.queryOptions({
            organizationId: organization.id,
            skillId,
        }),
    );

    return (
        <HydrateClient>
            <SkillTrack_Skill_Content skillId={skillId} />
        </HydrateClient>
    );
}
