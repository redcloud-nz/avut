/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-track/packages
 */

import { Std } from "@/components/blocks/std";
import { TITLE_SEPARATOR } from "@/lib/constants";
import { SkillTrack_Packages_List } from "@/modules/skill-track/components/packages-list";
import { getOrganizationBySlug } from "@/server/cache/organization";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export const metadata = {
    title: `Packages ${TITLE_SEPARATOR} Skill Track`,
};

export default async function SkillTrack_Packages_Page(
    props: PageProps<"/orgs/[slug]/skill-track/packages">,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    prefetch(
        trpc.skillPackageSubscriptions.listPackages.queryOptions({
            organizationId: organization.id,
        }),
    );

    return (
        <HydrateClient>
            <Std.ScrollContainer>
                <SkillTrack_Packages_List />
            </Std.ScrollContainer>
        </HydrateClient>
    );
}
