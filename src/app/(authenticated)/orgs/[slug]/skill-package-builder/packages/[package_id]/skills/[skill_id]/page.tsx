/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]
 */
"use client";

import { use } from "react";

import { and, eq, useLiveSuspenseQuery } from "@tanstack/react-db";

import { Lexington } from "@/components/blocks/lexington";
import { Hermes } from "@/components/blocks/hermes";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardType,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Link } from "@/components/ui/link";

import { useOrganization } from "@/hooks/use-organization";
import { getSkillsCollection } from "@/lib/collections/skills";
import { getSkillGroupsCollection } from "@/lib/collections/skill-groups";
import { getSkillPackagesCollection } from "@/lib/collections/skill-packages";
import * as Paths from "@/paths";

import { SkillPackageBuilder_Skill_Menu } from "./skill-menu";

export default function SkillPackageBuilder_Skill_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]`>,
) {
    const { slug, package_id, skill_id } = use(props.params);
    const organization = useOrganization();

    const { data: skill } = useLiveSuspenseQuery((q) =>
        q
            .from({ skill: getSkillsCollection(organization.id) })
            .innerJoin(
                { skillPackage: getSkillPackagesCollection(organization.id) },
                ({ skill, skillPackage }) =>
                    eq(skill.skillPackageId, skillPackage.id),
            )
            .join(
                { skillGroup: getSkillGroupsCollection(organization.id) },
                ({ skill, skillGroup }) =>
                    eq(skill.skillGroupId, skillGroup.id),
            )
            .where(({ skill }) =>
                and(
                    eq(skill.id, skill_id),
                    eq(skill.skillPackageId, package_id),
                ),
            )
            .select(({ skill, skillGroup, skillPackage }) => ({
                ...skill,
                skillGroup,
                skillPackage,
            }))
            .findOne(),
    );

    if (!skill) throw new Error(`Skill (${skill_id}) not found`);

    const packagePath = Paths.org(slug).skillPackageBuilder.skillPackage(
        skill.skillPackage,
    );

    return (
        <Lexington.Root>
            <Lexington.Header
                breadcrumbs={[
                    Paths.org(slug).skillPackageBuilder.index,
                    packagePath.index,
                    "Skills",
                    skill.name,
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
                                                    to={Paths.org(slug)
                                                        .skillPackageBuilder.skillPackage(
                                                            package_id,
                                                        )
                                                        .group(
                                                            skill.skillGroup.id,
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
