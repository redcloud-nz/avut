/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-package-builder
 */

import { AVUTLogo } from "@/components/art/avut-logo";
import { Std } from "@/components/blocks/std";

import { route } from "@/lib/routes";
import { SkillPackageBuilder_Packages_List } from "./packages/packages-list";
import { requireOrganization } from "@/server/organization-access";

export default async function SkillPackageBuilder_Index_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder`>,
) {
    const { slug } = await props.params;
    const { organization } = await requireOrganization(slug);
    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Skill Package Builder",
                        href: route("/orgs/[slug]/skill-package-builder", { slug }),
                    },
                ]}
            />
            <Std.ScrollContainer>
                <div className="flex flex-col items-center my-4 gap-4">
                    <AVUTLogo />
                    <div className="font-semibold">Skill Package Builder Module</div>
                </div>
                <SkillPackageBuilder_Packages_List organization={organization} />
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
