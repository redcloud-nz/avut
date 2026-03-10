/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/skill-package-builder/packages/[package_id]/history
 */
"use client";

import { use } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Lexington } from "@/components/blocks/lexington";
import { NotImplemented } from "@/components/nav/errors";

import { useOrganization } from "@/hooks/use-organization";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";
import { eq, useLiveSuspenseQuery } from "@tanstack/react-db";
import { getSkillPackagesCollection } from "@/lib/collections/skill-packages";

export default function SkillPackageBuilder_Package_History_Page(
    props: PageProps<`/main/[slug]/skill-package-builder/packages/[package_id]/history`>,
) {
    const { slug, package_id } = use(props.params);
    const organization = useOrganization();

    const { data: skillPackage } = useLiveSuspenseQuery((q) =>
        q
            .from({ skillPackage: getSkillPackagesCollection(organization.id) })
            .where(({ skillPackage }) => eq(skillPackage.id, package_id))
            .findOne(),
    );

    if (!skillPackage)
        throw new Error(`Skill Package (${package_id}) not found`);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.main(slug).skillPackageBuilder.index,
                    Paths.main(slug).skillPackageBuilder.skillPackages,
                    {
                        ...Paths.main(slug).skillPackageBuilder.skillPackage(
                            package_id,
                        ).index,
                        label: skillPackage.name,
                    },
                    "History",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column
                    width="lg"
                    className="h-full flex flex-col justify-center"
                >
                    <NotImplemented />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
