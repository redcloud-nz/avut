/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-author/packages
 */

import { Lexington } from "@/components/blocks/lexington";

import * as Paths from "@/paths";
import { getOrganizationBySlug } from "@/server/organization";
import { SkillPackageAuthorModules_SkillPackages_List } from "./package-list";

export const metadata = {
    title: "Skill Packages",
};

export default async function SkillPackageAuthorModules_SkillPackages_Page(
    props: PageProps<`/orgs/[slug]/skill-package-author/packages`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageAuthor.index,
                    Paths.org(slug).skillPackageAuthor.skillPackages,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <SkillPackageAuthorModules_SkillPackages_List
                        organization={organization}
                    />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
