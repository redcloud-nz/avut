/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]
 */
"use client";

import { useRouter } from "next/navigation";
import { use } from "react";
import { toast } from "sonner";

import { and, eq, useLiveSuspenseQuery } from "@tanstack/react-db";

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
import { Link } from "@/components/ui/link";

import { useOrganization } from "@/hooks/use-organization";
import { getSkillGroupsCollection } from "@/lib/collections/skill-groups";
import { getSkillPackagesCollection } from "@/lib/collections/skill-packages";
import * as Paths from "@/paths";

import { SkillPackageBuilder_Group_Menu } from "./group-menu";
import { SkillPackageBuilder_Group_Skills_List } from "./group-skills-list";

export default function SkillPackageBuilder_Group_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]`>,
) {
    const { slug, package_id, group_id } = use(props.params);
    const organization = useOrganization();
    const router = useRouter();

    const skillGroupsCollection = getSkillGroupsCollection(organization.id);

    const { data: skillGroup } = useLiveSuspenseQuery((q) =>
        q
            .from({ skillGroup: skillGroupsCollection })
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

    function handleArchive() {
        toast.promise(
            async () => {
                const tx = skillGroupsCollection.update(
                    skillGroup!.id,
                    (draft) => {
                        draft.status = "Archived";
                    },
                );
                await tx.isPersisted.promise;
            },
            {
                loading: "Archiving skill group...",
                success: "Skill group archived.",
                error: (error) =>
                    "Error archiving skill group." + error.message,
            },
        );
    }

    function handleDelete() {
        toast.promise(
            async () => {
                router.push(
                    Paths.org(
                        organization.slug,
                    ).skillPackageBuilder.skillPackage(
                        skillGroup!.skillPackageId,
                    ).index.href,
                );

                // Wait for the navigation to complete before performing the delete operation.
                await new Promise((resolve) => setTimeout(resolve, 200));

                const tx = skillGroupsCollection.delete(skillGroup!.id);

                await tx.isPersisted.promise;
            },
            {
                loading: "Deleting skill group...",
                success: "Skill group deleted",
                error: (error) =>
                    `Failed to delete skill group: ${error.message}`,
            },
        );
    }

    function handleRestore() {
        toast.promise(
            async () => {
                const tx = skillGroupsCollection.update(
                    skillGroup!.id,
                    (draft) => {
                        draft.status = "Active";
                    },
                );
                await tx.isPersisted.promise;
            },
            {
                loading: "Restoring skill group...",
                success: "Skill group restored.",
                error: (error) =>
                    "Error restoring skill group." + error.message,
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
                        label: skillGroup.skillPackage!.name,
                    },
                    "Groups",
                    skillGroup.name,
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
                                {skillGroup.skillPackage.name}
                            </Hermes.BackButton>
                        </Hermes.SectionHeader>
                        <Card>
                            <CardHeader>
                                <CardTitle>{skillGroup.name}</CardTitle>
                                <CardDescription>Skill Group</CardDescription>
                                <CardAction>
                                    <SkillPackageBuilder_Group_Menu
                                        onArchive={handleArchive}
                                        onDelete={handleDelete}
                                        onRestore={handleRestore}
                                        skillGroup={skillGroup}
                                    />
                                </CardAction>
                            </CardHeader>
                            <CardContent>
                                <FieldGroup>
                                    <Field orientation="responsive">
                                        <FieldLabel>Group ID</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            format="id"
                                            value={skillGroup.id}
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Package</FieldLabel>
                                        <FieldValue className="min-w-1/2">
                                            <Link
                                                to={
                                                    Paths.org(
                                                        slug,
                                                    ).skillPackageBuilder.skillPackage(
                                                        package_id,
                                                    ).index
                                                }
                                            >
                                                {skillGroup.skillPackage.name}
                                            </Link>
                                        </FieldValue>
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Name</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={skillGroup.name}
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Description</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={
                                                skillGroup.description ?? "-"
                                            }
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Created</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={skillGroup.createdAt}
                                            format="dateWithDistance"
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Updated</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={skillGroup.updatedAt}
                                            format="dateWithDistance"
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Status</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={skillGroup.status}
                                            action={
                                                skillGroup.status ==
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
                    <SkillPackageBuilder_Group_Skills_List
                        skillGroup={skillGroup}
                    />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
