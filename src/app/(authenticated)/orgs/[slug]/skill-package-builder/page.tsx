/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-package-builder
 */

import { AVUTLogo } from "@/components/art/avut-logo";
import { Lexington } from "@/components/blocks/lexington";

import * as Paths from "@/paths";
import { getOrganizationBySlug } from "@/server/organization";
import { SkillPackageBuilder_Packages_List } from "./packages/packages-list";

export default async function SkillPackageBuilder_Index_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);
    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[Paths.org(slug).skillPackageBuilder.index]}
            />
            <Lexington.Page>
                <Lexington.Column width="xl">
                    <div className="flex flex-col items-center my-4 gap-4">
                        <AVUTLogo />
                        <div className="font-semibold">
                            Skill Package Builder Module
                        </div>
                    </div>
                    <SkillPackageBuilder_Packages_List
                        organization={organization}
                    />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
