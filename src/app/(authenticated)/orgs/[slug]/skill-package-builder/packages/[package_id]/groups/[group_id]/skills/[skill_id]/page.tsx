/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/skills/[skill_id]
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
import { Link } from "@/components/ui/link";

import { useSkill } from "@/hooks/use-skill";
import * as Paths from "@/paths";

import { SkillPackageBuilder_Skill_Menu } from "./skill-menu";

export default function SkillPackageBuilder_Skill_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]/skills/[skill_id]`>,
) {
    const { slug, package_id, group_id, skill_id } = use(props.params);

    const skill = useSkill({
        skillPackageId: package_id,
        skillGroupId: group_id,
        skillId: skill_id,
    });

    const packagePath = Paths.org(slug).skillPackageBuilder.skillPackage(
        skill.skillPackage,
    );

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageBuilder.index,
                    packagePath.index,
                    "Groups",
                    packagePath.group(skill.skillGroup).index,
                    "Skills",
                    skill.name,
                ]}
            />
            <Lexington.Page>
                <Lexington.Column width="lg">
                    <Hermes.Section>
                        <Hermes.SectionHeader>
                            <Hermes.BackButton
                                to={packagePath.group(skill.skillGroup).index}
                            >
                                Group
                            </Hermes.BackButton>
                        </Hermes.SectionHeader>
                        <Card>
                            <CardHeader>
                                <CardTitle>{skill.name}</CardTitle>
                                <CardDescription>Skill</CardDescription>
                                <CardAction>
                                    <SkillPackageBuilder_Skill_Menu
                                        skill={skill}
                                    />
                                </CardAction>
                            </CardHeader>
                            <CardContent>
                                <FieldGroup>
                                    <Field orientation="responsive">
                                        <FieldLabel>Skill ID</FieldLabel>
                                        <FieldValue
                                            value={skill.id}
                                            className="min-w-1/2"
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
                                                {skill.skillPackage.name}
                                            </Link>
                                        </FieldValue>
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Group</FieldLabel>
                                        {skill.skillGroup ? (
                                            <FieldValue className="min-w-1/2">
                                                <Link
                                                    to={
                                                        Paths.org(slug)
                                                            .skillPackageBuilder.skillPackage(
                                                                package_id,
                                                            )
                                                            .group(
                                                                skill.skillGroup
                                                                    .id,
                                                            ).index
                                                    }
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
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={skill.name}
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Description</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={skill.description}
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Required</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={
                                                skill.defaultRequired
                                                    ? "Yes"
                                                    : "No"
                                            }
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>
                                            Revalidation Frequency
                                        </FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={
                                                skill.frequency
                                                    ? `${skill.frequency} months`
                                                    : "None"
                                            }
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Created</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={skill.createdAt}
                                            format="dateWithDistance"
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Updated</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={skill.updatedAt}
                                            format="dateWithDistance"
                                        />
                                    </Field>
                                    <Field orientation="responsive">
                                        <FieldLabel>Status</FieldLabel>
                                        <FieldValue
                                            className="min-w-1/2"
                                            value={skill.status}
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
