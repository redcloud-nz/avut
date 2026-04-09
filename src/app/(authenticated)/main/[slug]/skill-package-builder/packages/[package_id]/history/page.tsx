/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/skill-package-builder/packages/[package_id]/history
 */
"use client";

import { use } from "react";

import { Lexington } from "@/components/blocks/lexington";
import { NotImplemented } from "@/components/nav/errors";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";

import { useSkillPackage } from "@/hooks/use-skill-package";

export default function SkillPackageBuilder_Package_History_Page(
    props: PageProps<`/main/[slug]/skill-package-builder/packages/[package_id]/history`>,
) {
    const { slug, package_id } = use(props.params);
    const organization = useOrganization();

    const skillPackage = useSkillPackage(package_id);

    if (!skillPackage) throw new Error(`Skill Package (${package_id}) not found`);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    {
                        label: "Skill Package Builder",
                        href: route("/main/[slug]/skill-package-builder", { slug }),
                    },
                    {
                        label: skillPackage.name,
                        href: route("/main/[slug]/skill-package-builder/packages/[package_id]", {
                            slug,
                            package_id,
                        }),
                    },
                    "History",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg" className="h-full flex flex-col justify-center">
                    <NotImplemented />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
