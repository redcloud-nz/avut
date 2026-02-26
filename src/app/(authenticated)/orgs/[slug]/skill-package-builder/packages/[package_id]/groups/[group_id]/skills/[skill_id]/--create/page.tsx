/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]/--create
 */
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { use } from "react";
import { toast } from "sonner";

import { and, eq, useLiveSuspenseQuery } from "@tanstack/react-db";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import { useOrganization } from "@/hooks/use-organization";
import { getSkillsCollection } from "@/lib/collections/skills";
import { getSkillGroupsCollection } from "@/lib/collections/skill-groups";
import { getSkillPackagesCollection } from "@/lib/collections/skill-packages";
import { ModifiableSkill, SkillId } from "@/lib/schemas/skill";
import * as Paths from "@/paths";

import { SkillPackageBuilder_Skill_Form } from "../../skill-form";
import { SkillGroup } from "@/lib/schemas/skill-group";

/**
 * Page to create a new skill within a skill package. Renders a form for entering skill details and handles form submission to create the skill in the database.
 */
export default function SkillPackageBuilder_CreateSkill_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/skills/[skill_id]/--create`>,
) {
    const { slug, package_id, group_id, skill_id } = use(props.params);

    const organization = useOrganization();
    const router = useRouter();

    const { data: queryData } = useLiveSuspenseQuery((q) =>
        q
            .from({ skillPackage: getSkillPackagesCollection(organization.id) })
            .innerJoin(
                { skillGroup: getSkillGroupsCollection(organization.id) },
                ({ skillPackage, skillGroup }) =>
                    eq(skillPackage.id, skillGroup.skillPackageId),
            )
            .where(({ skillPackage, skillGroup }) =>
                and(
                    eq(skillPackage.id, package_id),
                    eq(skillGroup.id, group_id),
                ),
            )

            .findOne(),
    );

    if (!queryData)
        throw new Error(
            `Skill Package (${package_id}) or Skill Group (${group_id}) not found`,
        );

    const { skillPackage, skillGroup } = queryData;

    const skillId = SkillId.schema.parse(skill_id);

    function handleCreate(formData: ModifiableSkill) {
        toast.promise(
            async () => {
                const collection = getSkillsCollection(organization.id);
                const tx = collection.insert({
                    id: skillId,
                    skillPackageId: skillPackage.id,
                    skillGroupId: skillGroup.id,
                    sequence: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    ...formData,
                });

                await new Promise((resolve) => setTimeout(resolve, 100));

                router.push(
                    Paths.org(organization.slug)
                        .skillPackageBuilder.skillPackage(skillPackage.id)
                        .group(skillGroup.id)
                        .skill(skillId).href,
                );

                await tx.isPersisted.promise;
            },
            {
                loading: "Creating Skill...",
                success: "Skill created",
                error: (error) => `Failed to create Skill: ${error.message}`,
            },
        );
    }

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
                            id={skillId}
                            defaultValues={{
                                name: "",
                                description: "",
                                tags: [],
                                properties: {},
                                defaultRequired: false,
                                frequency: 12,
                                status: "Active",
                            }}
                            onSubmit={handleCreate}
                            skillPackage={skillPackage}
                            skillGroup={skillGroup ?? null}
                        />
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
