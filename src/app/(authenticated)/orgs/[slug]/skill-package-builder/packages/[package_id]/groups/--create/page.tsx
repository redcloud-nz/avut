/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/groups/--create
 */
"use client";

import { useRouter } from "next/navigation";
import { use, useMemo } from "react";
import { toast } from "sonner";

import { eq, useLiveSuspenseQuery } from "@tanstack/react-db";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import * as Paths from "@/paths";
import { useOrganization } from "@/hooks/use-organization";
import { getSkillGroupsCollection } from "@/lib/collections/skill-groups";
import { getSkillPackagesCollection } from "@/lib/collections/skill-packages";
import { ModifiableSkillGroup, SkillGroupId } from "@/lib/schemas/skill-group";

import { SkillPackageBuilder_Group_Form } from "../group-form";

/**
 * Page for creating a new skill group within a skill package. Fetches the skill package data and renders the group creation form.
 * On form submission, creates the skill group in the database and navigates to the new group's page.
 */
export default function SkillPackageBuilder_CreateGroup_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/--create`>,
) {
    const { slug, package_id } = use(props.params);
    const organization = useOrganization();
    const router = useRouter();

    const { data: skillPackage } = useLiveSuspenseQuery((q) =>
        q
            .from({ skillPackage: getSkillPackagesCollection(organization.id) })
            .where(({ skillPackage }) => eq(skillPackage.id, package_id))
            .findOne(),
    );

    if (!skillPackage)
        throw new Error(`Skill Package (${package_id}) not found`);

    const groupId = useMemo(() => SkillGroupId.create(), []);

    function handleCreate(formData: ModifiableSkillGroup) {
        toast.promise(
            async () => {
                const collection = getSkillGroupsCollection(organization.id);
                const tx = collection.insert({
                    id: groupId,
                    skillPackageId: skillPackage!.id,
                    parentGroupId: null,
                    ...formData,
                    sequence: 0,
                    status: "Active",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });

                await new Promise((resolve) => setTimeout(resolve, 100));

                router.push(
                    Paths.org(organization.slug)
                        .skillPackageBuilder.skillPackage(skillPackage!.id)
                        .group(groupId).href,
                );

                await tx.isPersisted.promise;
            },
            {
                loading: "Creating the skill group...",
                success: "Skill group created!",
                error: (error) =>
                    `Failed to create the skill group: ${error.message}`,
            },
        );
    }

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
                                        package_id,
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
                                status: "Active",
                            }}
                            onSubmit={handleCreate}
                            skillPackage={skillPackage}
                        />
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
