/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-track/catalogue/[package_id]
 */

import { Metadata } from "next";

import { Std } from "@/components/blocks/std";
import { SkillTrack_CataloguePackage_Content } from "@/components/skill-track/catalogue-package-content";

import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { requireOrganization } from "@/server/organization-access";
import { fetchQuery, HydrateClient, prefetch, trpc } from "@/trpc/server";

type Props = PageProps<"/orgs/[slug]/skill-track/catalogue/[package_id]">;

export async function generateMetadata(props: Props): Promise<Metadata> {
    const { slug, package_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const skillPackageId = SkillPackageId.schema.parse(package_id);
    const skillPackage = await fetchQuery(
        trpc.skills.getPackage.queryOptions({
            organizationId: organization.id,
            skillPackageId,
        }),
    );

    return { title: `${skillPackage.name} ${TITLE_SEPARATOR} Catalogue` };
}

export default async function SkillTrack_CataloguePackage_Page(props: Props) {
    const { slug, package_id } = await props.params;
    const { organization } = await requireOrganization(slug);

    const skillPackageId = SkillPackageId.schema.parse(package_id);

    prefetch(
        trpc.skills.getPackage.queryOptions({
            organizationId: organization.id,
            skillPackageId,
        }),
    );

    return (
        <HydrateClient>
            <Std.SidebarInset>
                <SkillTrack_CataloguePackage_Content skillPackageId={skillPackageId} />
            </Std.SidebarInset>
        </HydrateClient>
    );
}
