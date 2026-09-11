/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]
 */

import { Metadata } from "next";

import { SkillPackageBuilder_Package_Content } from "@/components/skill-package-builder/package-content";
import { Std } from "@/components/blocks/std";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]`>;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, package_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const skillPackageId = SkillPackageId.schema.parse(package_id);
    const skillPackage = await fetchQuery(
        trpc.skillPackageBuilder.getPackage.queryOptions({
            organizationId: organization.id,
            skillPackageId,
        }),
    );

    return { title: `${skillPackage.name} ${TITLE_SEPARATOR} Skill Package Builder` };
}

export default async function SkillPackageBuilder_Package_Page(props: Props) {
    const { slug, package_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const skillPackageId = SkillPackageId.schema.parse(package_id);

    prefetch(
        trpc.skillPackageBuilder.getPackage.queryOptions({
            organizationId: organization.id,
            skillPackageId,
        }),
    );
    prefetch(
        trpc.skillPackageBuilder.listGroups.queryOptions({
            organizationId: organization.id,
            skillPackageId,
        }),
    );
    prefetch(
        trpc.skillPackageBuilder.listSkills.queryOptions({
            organizationId: organization.id,
            skillPackageId,
        }),
    );

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <SkillPackageBuilder_Package_Content skillPackageId={skillPackageId} />
            </Std.SidebarInset>
        </HydrateClient>
    );
}
