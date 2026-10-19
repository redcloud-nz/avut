/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-track/catalogue/[package_id]/groups/[group_id]
 */

import { Metadata } from "next";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { SkillTrack_SkillGroup_Content } from "@/modules/skill-track/components/group-content";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/skill-track/catalogue/[package_id]/groups/[group_id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, package_id, group_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const skillPackageId = SkillPackageId.schema.parse(package_id);
    const skillGroupId = SkillGroupId.schema.parse(group_id);
    const group = await fetchQuery(
        trpc.skillPackageSubscriptions.getGroup.queryOptions({
            organizationId: organization.id,
            skillPackageId,
            skillGroupId,
        }),
    );

    return { title: `${group.name} ${TITLE_SEPARATOR} ${group.skillPackage.name}` };
}

export default async function SkillTrack_SkillGroup_Page(props: Props) {
    const { slug, package_id, group_id } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    const skillPackageId = SkillPackageId.schema.parse(package_id);
    const skillGroupId = SkillGroupId.schema.parse(group_id);

    prefetch(
        trpc.skillPackageSubscriptions.getGroup.queryOptions({
            organizationId: organization.id,
            skillPackageId,
            skillGroupId,
        }),
    );

    return (
        <HydrateClient>
            <SkillTrack_SkillGroup_Content
                skillPackageId={skillPackageId}
                skillGroupId={skillGroupId}
            />
        </HydrateClient>
    );
}
