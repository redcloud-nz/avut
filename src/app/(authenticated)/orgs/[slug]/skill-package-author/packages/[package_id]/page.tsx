/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-author/packages/[package_id]
 */
"use client";

import { use } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Lexington } from "@/components/blocks/lexington";
import { Hermes } from "@/components/blocks/hermes";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Link } from "@/components/ui/link";

import { useOrganization } from "@/hooks/use-organization";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

import { SkillPackageAuthor_PackageMenu } from "./skill-package-menu";

export default function SkillPackageAuthorModule_Package_Page(
    props: PageProps<`/orgs/[slug]/skill-package-author/packages/[package_id]`>,
) {
    const { slug, package_id } = use(props.params);
    const organization = useOrganization();

    const { data: skillPackage } = useSuspenseQuery(
        trpc.skills.getPackage.queryOptions({
            organizationId: organization.id,
            skillPackageId: package_id,
        }),
    );

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageAuthor.index,
                    Paths.org(slug).skillPackageAuthor.skillPackages,
                    skillPackage.name,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton
                                to={
                                    Paths.org(slug).skillPackageAuthor
                                        .skillPackages
                                }
                            >
                                Skill Packages
                            </Hermes.BackButton>
                            <ButtonGroup>
                                <Protect
                                    orgId={organization.id}
                                    permissions={{ skillPackage: ["update"] }}
                                >
                                    <Button variant="outline" asChild>
                                        <Link
                                            to={
                                                Paths.org(
                                                    slug,
                                                ).skillPackageAuthor.skillPackage(
                                                    skillPackage.id,
                                                ).update
                                            }
                                        >
                                            <ObjectIcons.Edit /> Edit
                                        </Link>
                                    </Button>
                                </Protect>
                                <SkillPackageAuthor_PackageMenu
                                    organization={organization}
                                    skillPackage={skillPackage}
                                />
                            </ButtonGroup>
                        </Hermes.SectionHeader>
                        <Card>
                            <CardHeader>
                                <CardTitle>{skillPackage.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <FieldGroup>
                                    <Field orientation="responsive">
                                        <FieldLabel>
                                            Skill Package ID
                                        </FieldLabel>
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
                                        <FieldValue className="min-w-1/2">
                                            {skillPackage.description}
                                        </FieldValue>
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Created At</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={skillPackage.createdAt}
                                            format="dateWithDistance"
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Updated At</FieldLabel>
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
                                </FieldGroup>
                            </CardContent>
                        </Card>
                    </Hermes.Section>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
