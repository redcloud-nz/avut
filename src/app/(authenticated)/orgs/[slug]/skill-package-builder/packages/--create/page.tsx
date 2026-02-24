/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/--create
 */

"use client";

import { useRouter } from "next/navigation";
import { use, useMemo } from "react";
import { toast } from "sonner";

import { Hermes } from "@/components/blocks/hermes";
import { Lexington } from "@/components/blocks/lexington";

import { useOrganization } from "@/hooks/use-organization";
import { getSkillPackagesCollection } from "@/lib/collections/skill-packages";
import {
    ModifiableSkillPackage,
    SkillPackageId,
} from "@/lib/schemas/skill-package";
import * as Paths from "@/paths";

import { SkillPackageBuilder_Package_Form } from "../package-form";

/**
 * Page for creating a new skill package.
 */
export default function SkillPackageBuilder_CreatePackage_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/--create`>,
) {
    const { slug } = use(props.params);

    const organization = useOrganization();
    const router = useRouter();

    const packageId = useMemo(() => SkillPackageId.create(), []);

    function handleCreate(formData: ModifiableSkillPackage) {
        toast.promise(
            async () => {
                router.push(
                    Paths.org(
                        organization.slug,
                    ).skillPackageBuilder.skillPackage(packageId).index.href,
                );

                const collection = getSkillPackagesCollection(organization.id);
                const tx = collection.insert({
                    id: packageId,
                    ...formData,
                    status: "Active",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });

                await tx.isPersisted.promise;
            },
            {
                loading: "Creating skill package...",
                success: "Skill package created!",
                error: (error) =>
                    `Failed to create skill package: ${error.message}`,
            },
        );
    }

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageBuilder.index,
                    Paths.org(slug).skillPackageBuilder.skillPackages.create,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton
                                to={
                                    Paths.org(slug).skillPackageBuilder
                                        .skillPackages
                                }
                            >
                                Package List
                            </Hermes.BackButton>
                        </Hermes.SectionHeader>
                        <SkillPackageBuilder_Package_Form
                            formMode="Create"
                            defaultValues={{
                                id: packageId,
                                name: "",
                                description: "",
                                tags: [],
                                properties: {},
                                status: "Active",
                            }}
                            onSubmit={handleCreate}
                        />
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
