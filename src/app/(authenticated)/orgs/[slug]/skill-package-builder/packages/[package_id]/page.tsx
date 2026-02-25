/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]
 */
"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import { toast } from "sonner";

import { eq, useLiveSuspenseQuery } from "@tanstack/react-db";

import { Lexington } from "@/components/blocks/lexington";
import { Hermes } from "@/components/blocks/hermes";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";

import { useOrganization } from "@/hooks/use-organization";
import { getSkillPackagesCollection } from "@/lib/collections/skill-packages";
import * as Paths from "@/paths";

import { SkillPackageBuilder_Package_Contents_List } from "./package-contents";
import { SkillPackageBuilder_Package_Menu } from "./package-menu";

export default function SkillPackageBuilder_Package_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]`>,
) {
    const { slug, package_id } = use(props.params);
    const organization = useOrganization();
    const router = useRouter();

    const skillPackagesCollection = getSkillPackagesCollection(organization.id);

    const { data: skillPackage } = useLiveSuspenseQuery((q) =>
        q
            .from({ skillPackage: skillPackagesCollection })
            .where(({ skillPackage }) => eq(skillPackage.id, package_id))
            .findOne(),
    );

    if (!skillPackage)
        throw new Error(`Skill Package (${package_id}) not found`);

    function handleArchive() {
        toast.promise(
            async () => {
                const tx = skillPackagesCollection.update(
                    skillPackage!.id,
                    (draft) => {
                        draft.status = "Archived";
                    },
                );
                await tx.isPersisted.promise;
            },
            {
                loading: "Archiving skill package...",
                success: "Skill package archived.",
                error: (error) =>
                    "Error archiving skill package." + error.message,
            },
        );
    }

    function handleDelete() {
        toast.promise(
            async () => {
                router.push(
                    Paths.org(organization.slug).skillPackageBuilder
                        .skillPackages.href,
                );

                // Wait for the navigation to complete before performing the delete operation.
                await new Promise((resolve) => setTimeout(resolve, 500));

                const tx = skillPackagesCollection.delete(skillPackage!.id);

                await tx.isPersisted.promise;
            },
            {
                loading: "Deleting skill package...",
                success: "Skill package deleted.",
                error: (error) =>
                    "Error deleting skill package." + error.message,
            },
        );
    }

    function handleRestore() {
        toast.promise(
            async () => {
                const tx = skillPackagesCollection.update(
                    skillPackage!.id,
                    (draft) => {
                        draft.status = "Active";
                    },
                );
                await tx.isPersisted.promise;
            },
            {
                loading: "Restoring skill package...",
                success: "Skill package restored.",
                error: (error) =>
                    "Error restoring skill package." + error.message,
            },
        );
    }

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageBuilder.index,
                    skillPackage.name,
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
                        <Card>
                            <CardHeader>
                                <CardTitle>{skillPackage.name}</CardTitle>
                                <CardDescription>Skill Package</CardDescription>
                                <CardAction>
                                    <SkillPackageBuilder_Package_Menu
                                        onArchive={handleArchive}
                                        onDelete={handleDelete}
                                        onRestore={handleRestore}
                                        skillPackage={skillPackage}
                                    />
                                </CardAction>
                            </CardHeader>
                            <CardContent>
                                <FieldGroup>
                                    <Field orientation="responsive">
                                        <FieldLabel>Package ID</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            format="id"
                                            value={skillPackage.id}
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Name</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={skillPackage.name}
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Description</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={skillPackage.description}
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Created</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={skillPackage.createdAt}
                                            format="dateWithDistance"
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Updated</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={skillPackage.updatedAt}
                                            format="dateWithDistance"
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Status</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={skillPackage.status}
                                            action={
                                                skillPackage.status ==
                                                "Archived" ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={handleRestore}
                                                    >
                                                        Restore
                                                    </Button>
                                                ) : null
                                            }
                                        />
                                    </Field>
                                </FieldGroup>
                            </CardContent>
                        </Card>
                    </Hermes.Section>
                    <SkillPackageBuilder_Package_Contents_List
                        skillPackage={skillPackage}
                    />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
