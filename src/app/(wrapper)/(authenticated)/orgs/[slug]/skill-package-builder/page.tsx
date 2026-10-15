/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /orgs/[slug]/skill-package-builder
 */

import { AVUTLogo } from "@/components/art/avut-logo";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { route } from "@/lib/routes";
import { SkillPackageBuilder_Packages_List } from "@/modules/skill-package-builder/components/packages-list";
import { isOrganizationModuleUsable } from "@/server/module-flags";
import { requireOrganizationWith } from "@/server/organization-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";

export default async function SkillPackageBuilder_Index_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder`>,
) {
    const { slug } = await props.params;
    if (!(await isOrganizationModuleUsable(slug, "skill-package-builder"))) return null;
    const { organization } = await requireOrganizationWith(slug, { skillPackage: ["view"] });

    prefetch(
        trpc.skillPackageBuilder.listPackages.queryOptions({ organizationId: organization.id }),
    );

    return (
        <HydrateClient>
            <>
                <Std.Navbar
                    breadcrumbs={[
                        {
                            label: "Skill Package Builder",
                            href: route("/orgs/[slug]/skill-package-builder", { slug }),
                        },
                    ]}
                    actions={<HelpButton id="skill-package-builder" />}
                />
                <Std.ScrollContainer>
                    <div className="flex flex-col items-center my-4 gap-4">
                        <AVUTLogo />
                        <div className="font-semibold">Skill Package Builder Module</div>
                    </div>
                    <SkillPackageBuilder_Packages_List organization={organization} />
                </Std.ScrollContainer>
            </>
        </HydrateClient>
    );
}
