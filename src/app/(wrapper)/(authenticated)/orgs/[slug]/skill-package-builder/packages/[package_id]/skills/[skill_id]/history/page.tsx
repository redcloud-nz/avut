/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]/history
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillId } from "@/lib/schemas/skill";
import { SkillPackageBuilder_SkillHistory_Content } from "@/modules/skill-package-builder/components/skill-history-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { fetchQuery, HydrateClient, prefetch, prefetchInfinite, trpc } from "@/trpc/server";

type Props =
    PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]/history`>;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, skill_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "skill-package-builder"))) return {};
    const organization = await getOrganizationBySlug(slug);

    const skillId = SkillId.schema.parse(skill_id);
    const skill = await fetchQuery(
        trpc.skillPackageBuilder.getSkill.queryOptions({
            organizationId: organization.id,
            skillId,
        }),
    );

    return { title: `${skill.name} History ${TITLE_SEPARATOR} Skill Package Builder` };
}

export default async function SkillPackageBuilder_SkillHistory_Page(props: Props) {
    const { slug, skill_id } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "skill-package-builder"))) return null;
    const organization = await getOrganizationBySlug(slug);

    const skillId = SkillId.schema.parse(skill_id);

    prefetch(
        trpc.skillPackageBuilder.getSkill.queryOptions({
            organizationId: organization.id,
            skillId,
        }),
    );
    // Same input as `ObjectHistory`'s client query (no `limit`), so the keys match.
    prefetchInfinite(
        trpc.history.listObjectHistory.infiniteQueryOptions(
            {
                organizationId: organization.id,
                objectType: "Skill",
                objectId: skillId,
            },
            { getNextPageParam: (page) => page.nextCursor ?? undefined },
        ),
    );

    return (
        <HydrateClient>
            <SkillPackageBuilder_SkillHistory_Content skillId={skillId} />
        </HydrateClient>
    );
}
