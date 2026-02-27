/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/--update
 */
"use client";

import { use } from "react";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import { useSkillPackage } from "@/hooks/use-skill-package";
import * as Paths from "@/paths";

import { SkillPackageBuilder_Package_Form } from "../package-form";

/**
 * Page for updating an existing skill package. Fetches the skill package data and renders the update form.
 * On form submission, updates the skill package in the database and navigates back to the package page.
 */
export default function SkillPackageBuilder_UpdatePackage_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/--update`>,
) {
    const { slug, package_id } = use(props.params);
    const skillPackage = useSkillPackage(package_id);

    const packagePath =
        Paths.org(slug).skillPackageBuilder.skillPackage(skillPackage);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageBuilder.index,
                    packagePath.index,
                    "Update",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton to={packagePath.index}>
                                Package
                            </Hermes.BackButton>
                        </Hermes.SectionHeader>
                        <SkillPackageBuilder_Package_Form
                            formMode="Update"
                            id={skillPackage.id}
                            defaultValues={skillPackage}
                        />
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
