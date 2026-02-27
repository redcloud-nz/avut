/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]
 */
"use client";

import { use } from "react";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import * as Paths from "@/paths";

import { SkillPackageBuilder_Skill_Form } from "../skill-form";
import { useSkill } from "@/hooks/use-skill";

export default function SkillPackageBuilder_UpdateSkill_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/skills/[skill_id]/--update`>,
) {
    const { slug, package_id, group_id, skill_id } = use(props.params);

    const skill = useSkill({
        skillPackageId: package_id,
        skillGroupId: group_id,
        skillId: skill_id,
    });

    const packagePath = Paths.org(slug).skillPackageBuilder.skillPackage(
        skill.skillPackage,
    );

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageBuilder.index,
                    packagePath.index,
                    "Skills",
                    packagePath.group(skill.skillGroup).skill(skill),
                    "Update",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton
                                to={packagePath
                                    .group(skill.skillGroup)
                                    .skill(skill)}
                            >
                                Skill
                            </Hermes.BackButton>
                        </Hermes.SectionHeader>

                        <SkillPackageBuilder_Skill_Form
                            formMode="Update"
                            skillId={skill.id}
                            defaultValues={skill}
                            skillPackage={skill.skillPackage}
                            skillGroup={skill.skillGroup ?? null}
                        />
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
