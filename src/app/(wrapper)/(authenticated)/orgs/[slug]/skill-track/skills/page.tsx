/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/skills
 */

import { Std } from "@/components/blocks/std";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillTrack_SkillsList } from "@/modules/skill-track/components/skills-list";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Skills ${TITLE_SEPARATOR} Skill Track`,
};

export default async function SkillTrack_Skills_Page(
    props: PageProps<"/orgs/[slug]/skill-track/skills">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

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
