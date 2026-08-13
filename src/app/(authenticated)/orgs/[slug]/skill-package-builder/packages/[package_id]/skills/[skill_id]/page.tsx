/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]
 */

import { Metadata } from "next";

import { SkillPackageBuilder_Skill_Content } from "@/components/skill-package-builder/skill-content";
import { Std } from "@/components/blocks/std";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillId } from "@/lib/schemas/skill";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props =
    PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]`>;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, skill_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const skillId = SkillId.schema.parse(skill_id);
    const skill = await fetchQuery(
        trpc.skillPackageBuilder.getSkill.queryOptions({
            organizationId: organization.id,
            skillId,
        }),
    );

    return { title: `${skill.name} ${TITLE_SEPARATOR} Skill Package Builder` };
}

export default async function SkillPackageBuilder_Skill_Page(props: Props) {
    const { slug, skill_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const skillId = SkillId.schema.parse(skill_id);

    prefetch(
        trpc.skillPackageBuilder.getSkill.queryOptions({
            organizationId: organization.id,
            skillId,
        }),
    );

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <SkillPackageBuilder_Skill_Content skillId={skillId} />
            </Std.SidebarInset>
        </HydrateClient>
    );
}
