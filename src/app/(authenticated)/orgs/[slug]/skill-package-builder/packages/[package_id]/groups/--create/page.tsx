/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/groups/--create
 */
"use client";

import { use } from "react";

import { eq, useLiveSuspenseQuery } from "@tanstack/react-db";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import * as Paths from "@/paths";
import { useOrganization } from "@/hooks/use-organization";
import { getSkillPackagesCollection } from "@/lib/collections/skill-packages";

import SkillPackageBuilder_CreateGroup_Form from "./create-group";

export default function SkillPackageBuilder_CreateGroup_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/--create`>,
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
                    Paths.org(slug).skillPackageBuilder.index,
                    {
                        ...Paths.org(slug).skillPackageBuilder.skillPackage(
                            package_id,
                        ).index,
                        label: skillPackage.name,
                    },
                    "Groups",
                    "Create",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton
                                to={
                                    Paths.org(
                                        slug,
                                    ).skillPackageBuilder.skillPackage(
                                        package_id,
                                    ).index
                                }
                            >
                                Package
                            </Hermes.BackButton>
                        </Hermes.SectionHeader>
                        <SkillPackageBuilder_CreateGroup_Form
                            skillPackage={skillPackage}
                        />
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
