/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/skills/[skill_id]/--create
 */
"use client";

import { use } from "react";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import { useSkillGroup } from "@/hooks/use-skill-group";
import { SkillId } from "@/lib/schemas/skill";
import * as Paths from "@/paths";

import { SkillPackageBuilder_Skill_Form } from "../skill-form";

/**
 * Page to create a new skill within a skill package. Renders a form for entering skill details and handles form submission to create the skill in the database.
 */
export default function SkillPackageBuilder_CreateSkill_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/skills/[skill_id]/--create`>,
) {
    const { slug, package_id, group_id, skill_id } = use(props.params);

    const skillGroup = useSkillGroup({
        skillPackageId: package_id,
        skillGroupId: group_id,
    });

    const skillId = SkillId.schema.parse(skill_id);

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageBuilder.index,
                    Paths.org(slug).skillPackageBuilder.skillPackage(
                        skillGroup.skillPackage,
                    ).index,
                    "Groups",
                    Paths.org(slug)
                        .skillPackageBuilder.skillPackage(
                            skillGroup.skillPackage,
                        )
                        .group(skillGroup).index,
                    "Skills",
                    "Create",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            {skillGroup ? (
                                <Hermes.BackButton
                                    to={
                                        Paths.org(slug)
                                            .skillPackageBuilder.skillPackage(
                                                package_id,
                                            )
                                            .group(skillGroup.id).index
                                    }
                                >
                                    Group
                                </Hermes.BackButton>
                            ) : (
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
                            )}
                        </Hermes.SectionHeader>
                        <SkillPackageBuilder_Skill_Form
                            formMode="Create"
                            skillId={skillId}
                            defaultValues={{
                                name: "",
                                description: "",
                                tags: [],
                                properties: {},
                                defaultRequired: false,
                                frequency: 12,
                            }}
                            skillPackage={skillGroup.skillPackage}
                            skillGroup={skillGroup}
                        />
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
