/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]
 */
"use client";

import { use } from "react";

import { Lexington } from "@/components/blocks/lexington";
import { Hermes } from "@/components/blocks/hermes";
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

import { useSkillPackage } from "@/hooks/use-skill-package";
import * as Paths from "@/paths";

import { SkillPackageBuilder_Package_Contents_List } from "./package-contents";
import { SkillPackageBuilder_Package_Menu } from "./package-menu";

export default function SkillPackageBuilder_Package_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]`>,
) {
    const { slug, package_id } = use(props.params);

    const skillPackage = useSkillPackage(package_id);

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
                                List
                            </Hermes.BackButton>
                        </Hermes.SectionHeader>
                        <Card>
                            <CardHeader>
                                <CardTitle>{skillPackage.name}</CardTitle>
                                <CardDescription>Skill Package</CardDescription>
                                <CardAction>
                                    <SkillPackageBuilder_Package_Menu
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
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Published</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={
                                                skillPackage.published
                                                    ? "Yes"
                                                    : "No"
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
