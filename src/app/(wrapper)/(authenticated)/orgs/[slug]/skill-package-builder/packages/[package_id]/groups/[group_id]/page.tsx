/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]
 */

import { Metadata } from "next";

import { SkillPackageBuilder_Group_Content } from "@/components/skill-package-builder/group-content";
import { Std } from "@/components/blocks/std";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props =
    PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]`>;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, group_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const skillGroupId = SkillGroupId.schema.parse(group_id);
    const skillGroup = await fetchQuery(
        trpc.skillPackageBuilder.getGroup.queryOptions({
            organizationId: organization.id,
            skillGroupId,
        }),
    );

    return { title: `${skillGroup.name} ${TITLE_SEPARATOR} Skill Package Builder` };
}

export default async function SkillPackageBuilder_Group_Page(props: Props) {
    const { slug, group_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const skillGroupId = SkillGroupId.schema.parse(group_id);

    prefetch(
        trpc.skillPackageBuilder.getGroup.queryOptions({
            organizationId: organization.id,
            skillGroupId,
        }),
    );

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <SkillPackageBuilder_Group_Content groupId={skillGroupId} />
            </Std.SidebarInset>
        </HydrateClient>
    );
}
