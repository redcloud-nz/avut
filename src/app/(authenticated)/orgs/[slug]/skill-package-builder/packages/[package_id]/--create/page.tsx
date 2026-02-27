/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/--create
 */

"use client";

import { use } from "react";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import { SkillPackageId } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";

import { SkillPackageBuilder_Package_Form } from "../package-form";

/**
 * Page for creating a new skill package.
 */
export default function SkillPackageBuilder_CreatePackage_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/--create`>,
) {
    const { slug, package_id } = use(props.params);

    const packageId = SkillPackageId.schema.parse(package_id);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageBuilder.index,
                    Paths.org(slug).skillPackageBuilder.skillPackages.create,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton
                                to={
                                    Paths.org(slug).skillPackageBuilder
                                        .skillPackages
                                }
                            >
                                Package List
                            </Hermes.BackButton>
                        </Hermes.SectionHeader>
                        <SkillPackageBuilder_Package_Form
                            formMode="Create"
                            id={packageId}
                            defaultValues={{
                                name: "",
                                description: "",
                                tags: [],
                                properties: {},
                            }}
                        />
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
