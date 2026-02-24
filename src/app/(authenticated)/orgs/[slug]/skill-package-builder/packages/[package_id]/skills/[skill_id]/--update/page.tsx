/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]
 */
"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import { toast } from "sonner";

import { and, eq, useLiveSuspenseQuery } from "@tanstack/react-db";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import { useOrganization } from "@/hooks/use-organization";
import { getSkillsCollection } from "@/lib/collections/skills";
import { getSkillGroupsCollection } from "@/lib/collections/skill-groups";
import { getSkillPackagesCollection } from "@/lib/collections/skill-packages";
import { ModifiableSkill } from "@/lib/schemas/skill";
import * as Paths from "@/paths";

import { SkillPackageBuilder_Skill_Form } from "../../skill-form";

export default function SkillPackageBuilder_UpdateSkill_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]/--update`>,
) {
    const { slug, package_id, skill_id } = use(props.params);
    const organization = useOrganization();
    const router = useRouter();

    const { data: skill } = useLiveSuspenseQuery((q) =>
        q
            .from({ skill: getSkillsCollection(organization.id) })
            .innerJoin(
                { skillPackage: getSkillPackagesCollection(organization.id) },
                ({ skill, skillPackage }) =>
                    eq(skill.skillPackageId, skillPackage.id),
            )
            .join(
                { skillGroup: getSkillGroupsCollection(organization.id) },
                ({ skill, skillGroup }) =>
                    eq(skill.skillGroupId, skillGroup.id),
            )
            .where(({ skill }) =>
                and(
                    eq(skill.id, skill_id),
                    eq(skill.skillPackageId, package_id),
                ),
            )
            .select(({ skill, skillGroup, skillPackage }) => ({
                ...skill,
                skillGroup,
                skillPackage,
            }))
            .findOne(),
    );

    if (!skill) throw new Error(`Skill (${skill_id}) not found`);

    function handleSubmit(formData: ModifiableSkill) {
        toast.promise(
            async () => {
                const collection = getSkillsCollection(organization.id);
                const tx = collection.update(skill!.id, (draft) => {
                    draft.name = formData.name;
                    draft.description = formData.description;
                    draft.tags = formData.tags;
                    draft.properties = formData.properties;
                    draft.defaultRequired = formData.defaultRequired;
                    draft.frequency = formData.frequency;
                });

                router.back();

                await tx.isPersisted.promise;
            },
            {
                loading: "Updating Skill...",
                success: "Skill updated",
                error: (error) => `Failed to update Skill: ${error.message}`,
            },
        );
    }

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
                    packagePath.skill(skill),
                    "Update",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton to={packagePath.skill(skill)}>
                                Skill
                            </Hermes.BackButton>
                        </Hermes.SectionHeader>

                        <SkillPackageBuilder_Skill_Form
                            formMode="Update"
                            id={skill.id}
                            defaultValues={skill}
                            onSubmit={handleSubmit}
                            skillPackage={skill.skillPackage}
                            skillGroup={skill.skillGroup ?? null}
                        />
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
