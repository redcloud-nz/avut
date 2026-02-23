/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages
 */

import { Lexington } from "@/components/blocks/lexington";

import * as Paths from "@/paths";
import { getOrganizationBySlug } from "@/server/organization";
import { SkillPackageBuilder_Packages_List } from "./packages-list";

export const metadata = {
    title: "Skill Packages",
};

export default async function SkillPackageBuilder_Packages_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageBuilder.index,
                    Paths.org(slug).skillPackageBuilder.skillPackages,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <SkillPackageBuilder_Packages_List
                        organization={organization}
                    />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
