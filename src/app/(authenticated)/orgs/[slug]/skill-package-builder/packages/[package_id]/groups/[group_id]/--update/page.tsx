/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/--update
 */
"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import { toast } from "sonner";

import { and, eq, useLiveSuspenseQuery } from "@tanstack/react-db";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import { useOrganization } from "@/hooks/use-organization";
import { getSkillGroupsCollection } from "@/lib/collections/skill-groups";
import { getSkillPackagesCollection } from "@/lib/collections/skill-packages";
import { ModifiableSkillGroup } from "@/lib/schemas/skill-group";
import * as Paths from "@/paths";

import { SkillPackageBuilder_Group_Form } from "../../group-form";

/**
 * Page to update an existing skill group. Fetches the skill group data and renders the update form.
 * On form submission, updates the skill group in the database and navigates back to the group page.
 */
export default function SkillPackageBuilder_UpdateGroup_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/--update`>,
) {
    const { slug, package_id, group_id } = use(props.params);
    const organization = useOrganization();
    const router = useRouter();

    const { data: skillGroup } = useLiveSuspenseQuery((q) =>
        q
            .from({ skillGroup: getSkillGroupsCollection(organization.id) })
            .innerJoin(
                { skillPackage: getSkillPackagesCollection(organization.id) },
                ({ skillGroup, skillPackage }) =>
                    eq(skillGroup.skillPackageId, skillPackage.id),
            )
            .where(({ skillGroup }) =>
                and(
                    eq(skillGroup.id, group_id),
                    eq(skillGroup.skillPackageId, package_id),
                ),
            )
            .select(({ skillGroup, skillPackage }) => ({
                ...skillGroup,
                skillPackage,
            }))
            .findOne(),
    );

    if (!skillGroup) throw new Error(`Skill Group (${group_id}) not found`);

    const packagePath = Paths.org(slug).skillPackageBuilder.skillPackage(
        skillGroup.skillPackage,
    );

    function handleUpdate(formData: ModifiableSkillGroup) {
        toast.promise(
            async () => {
                router.back();

                const collection = getSkillGroupsCollection(organization.id);
                const tx = collection.update(skillGroup!.id, (draft) => {
                    draft.name = formData.name;
                    draft.description = formData.description;
                    draft.tags = formData.tags;
                    draft.properties = formData.properties;
                });

                await tx.isPersisted.promise;
            },
            {
                loading: "Updating Skill Group...",
                success: "Skill Group updated",
                error: (error) =>
                    `Failed to update Skill Group: ${error.message}`,
            },
        );
    }

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageBuilder.index,
                    packagePath.index,
                    "Groups",
                    packagePath.group(skillGroup.id),
                    "Update",
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton
                                to={packagePath.group(skillGroup.id)}
                            >
                                Group
                            </Hermes.BackButton>
                        </Hermes.SectionHeader>
                        <SkillPackageBuilder_Group_Form
                            formMode="Update"
                            id={skillGroup.id}
                            defaultValues={skillGroup}
                            onSubmit={handleUpdate}
                            skillPackage={skillGroup.skillPackage}
                        />
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
