/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/--create
 */
"use client";

import { use } from "react";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import * as Paths from "@/paths";
import { SkillGroupId } from "@/lib/schemas/skill-group";

import { SkillPackageBuilder_Group_Form } from "../group-form";
import { useSkillPackage } from "@/hooks/use-skill-package";

/**
 * Page for creating a new skill group within a skill package. Fetches the skill package data and renders the group creation form.
 * On form submission, creates the skill group in the database and navigates to the new group's page.
 */
export default function SkillPackageBuilder_CreateGroup_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/--create`>,
) {
    const { slug, package_id, group_id } = use(props.params);

    const skillPackage = useSkillPackage(package_id);

    const groupId = SkillGroupId.schema.parse(group_id);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageBuilder.index,
                    Paths.org(slug).skillPackageBuilder.skillPackage(
                        skillPackage,
                    ).index,
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
                                        skillPackage,
                                    ).index
                                }
                            >
                                Package
                            </Hermes.BackButton>
                        </Hermes.SectionHeader>
                        <SkillPackageBuilder_Group_Form
                            formMode="Create"
                            id={groupId}
                            defaultValues={{
                                name: "",
                                description: "",
                                tags: [],
                                properties: {},
                            }}
                            skillPackage={skillPackage}
                        />
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
