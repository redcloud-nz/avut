/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/--update
 */
"use client";

import { use } from "react";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";
import { useSkillGroup } from "@/hooks/use-skill-group";
import * as Paths from "@/paths";

import { SkillPackageBuilder_Group_Form } from "../group-form";

/**
 * Page to update an existing skill group. Fetches the skill group data and renders the update form.
 */
export default function SkillPackageBuilder_UpdateGroup_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/--update`>,
) {
    const { slug, package_id, group_id } = use(props.params);

    const skillGroup = useSkillGroup({
        skillPackageId: package_id,
        skillGroupId: group_id,
    });

    const packagePath = Paths.org(slug).skillPackageBuilder.skillPackage(
        skillGroup.skillPackage.id,
    );

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageBuilder.index,
                    packagePath.index,
                    "Groups",
                    packagePath.group(skillGroup.id).index,
                    "Update",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton
                                to={packagePath.group(skillGroup.id).index}
                            >
                                Group
                            </Hermes.BackButton>
                        </Hermes.SectionHeader>
                        <SkillPackageBuilder_Group_Form
                            formMode="Update"
                            id={skillGroup.id}
                            defaultValues={skillGroup}
                            skillPackage={skillGroup.skillPackage}
                        />
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
