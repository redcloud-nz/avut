/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/--update
 */
"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import { toast } from "sonner";

import { eq, useLiveSuspenseQuery } from "@tanstack/react-db";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import { useOrganization } from "@/hooks/use-organization";
import { getSkillPackagesCollection } from "@/lib/collections/skill-packages";
import { ModifiableSkillPackage } from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";

import { SkillPackageBuilder_Package_Form } from "../../package-form";

/**
 * Page for updating an existing skill package. Fetches the skill package data and renders the update form.
 * On form submission, updates the skill package in the database and navigates back to the package page.
 */
export default function SkillPackageBuilder_UpdatePackage_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/--update`>,
) {
    const { slug, package_id } = use(props.params);
    const organization = useOrganization();
    const router = useRouter();

    // Fetch the skill package data
    const { data: skillPackage } = useLiveSuspenseQuery((q) =>
        q
            .from({ skillPackage: getSkillPackagesCollection(organization.id) })
            .where(({ skillPackage }) => eq(skillPackage.id, package_id))
            .findOne(),
    );

    // If the skill package is not found, throw an error
    if (!skillPackage)
        throw new Error(`Skill Package (${package_id}) not found`);

    const packagePath =
        Paths.org(slug).skillPackageBuilder.skillPackage(skillPackage);

    function handleUpdate(formData: ModifiableSkillPackage) {
        toast.promise(
            async () => {
                const collection = getSkillPackagesCollection(organization.id);
                const tx = collection.update(package_id, (draft) => {
                    draft.name = formData.name;
                    draft.description = formData.description;
                    draft.tags = formData.tags;
                    draft.properties = formData.properties;
                });

                router.back();

                await tx.isPersisted.promise;
            },
            {
                loading: "Updating skill package...",
                success: "Skill package updated",
                error: (error) =>
                    `Failed to update skill package: ${error.message}`,
            },
        );
    }

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
                            defaultValues={skillPackage}
                            onSubmit={handleUpdate}
                        />
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
