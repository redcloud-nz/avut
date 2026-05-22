/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]
 */
"use client";

import { use } from "react";

import { Lexington } from "@/components/blocks/lexington";
import { Hermes } from "@/components/blocks/hermes";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import Link from "next/link";

import { useOrganization } from "@/hooks/use-organization";
import { useSkill } from "@/hooks/use-skill";
import { route } from "@/lib/routes";

import { SkillPackageBuilder_Skill_Menu } from "./skill-menu";

export default function SkillPackageBuilder_Skill_Page(
    props: PageProps<`/main/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]`>,
) {
    const { slug, package_id, skill_id } = use(props.params);

    const organization = useOrganization();
    const skill = useSkill({
        skillPackageId: package_id,
        skillId: skill_id,
    });

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    {
                        label: "Skill Package Builder",
                        href: route("/main/[slug]/skill-package-builder", { slug }),
                    },
                    {
                        label: skill.skillPackage.name,
                        href: route("/main/[slug]/skill-package-builder/packages/[package_id]", {
                            slug,
                            package_id,
                        }),
                    },
                    "Skills",
                    skill.name,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Header>
                        <Hermes.BackButton
                            href={route(
                                "/main/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]",
                                { slug, package_id, group_id: skill.skillGroup.id },
                            )}
                            tooltip={`Back to skill group: ${skill.skillGroup.name}`}
                        />
                        <Hermes.Title>{skill.name}</Hermes.Title>
                        <Hermes.Action>
                            <SkillPackageBuilder_Skill_Menu skill={skill} />
                        </Hermes.Action>
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Skill Details</CardTitle>

                            <CardAction>
                                <Protect
                                    orgId={organization.id}
                                    permissions={{ organization: ["update"] }}
                                >
                                    <Button variant="ghost" size="icon" asChild>
                                        <Link
                                            href={route(
                                                "/main/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]/--update",
                                                { slug, package_id, skill_id },
                                            )}
                                        >
                                            <ObjectIcons.Edit />
                                        </Link>
                                    </Button>
                                </Protect>
                            </CardAction>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup>
                                <Field orientation="responsive">
                                    <FieldLabel>Skill ID</FieldLabel>
                                    <FieldValue value={skill.id} format="id" />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Package</FieldLabel>
                                    <FieldValue>
                                        <Link
                                            href={route(
                                                "/main/[slug]/skill-package-builder/packages/[package_id]",
                                                { slug, package_id },
                                            )}
                                        >
                                            {skill.skillPackage.name}
                                        </Link>
                                    </FieldValue>
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Group</FieldLabel>
                                    {skill.skillGroup ? (
                                        <FieldValue>
                                            <Link
                                                href={route(
                                                    "/main/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]",
                                                    {
                                                        slug,
                                                        package_id,
                                                        group_id: skill.skillGroup.id,
                                                    },
                                                )}
                                            >
                                                {skill.skillGroup.name}
                                            </Link>
                                        </FieldValue>
                                    ) : (
                                        <FieldValue value="" />
                                    )}
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Name</FieldLabel>
                                    <FieldValue value={skill.name} />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Description</FieldLabel>
                                    <FieldValue value={skill.description} />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Required</FieldLabel>
                                    <FieldValue value={skill.defaultRequired ? "Yes" : "No"} />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Revalidation Frequency</FieldLabel>
                                    <FieldValue
                                        value={
                                            skill.frequency ? `${skill.frequency} months` : "None"
                                        }
                                    />
                                </Field>

                                <FieldSeparator />

                                <Field orientation="responsive">
                                    <FieldLabel>Created</FieldLabel>
                                    <FieldValue value={skill.createdAt} format="dateWithDistance" />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Updated</FieldLabel>
                                    <FieldValue value={skill.updatedAt} format="dateWithDistance" />
                                </Field>
                                <Field orientation="responsive">
                                    <FieldLabel>Status</FieldLabel>
                                    <FieldValue value={skill.status} />
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
