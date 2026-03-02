/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]
 */
"use client";

import { use } from "react";

import { Lexington } from "@/components/blocks/lexington";
import { Hermes } from "@/components/blocks/hermes";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Link } from "@/components/ui/link";

import { useOrganization } from "@/hooks/use-organization";
import { useSkillGroup } from "@/hooks/use-skill-group";
import * as Paths from "@/paths";

import { SkillPackageBuilder_Group_Menu } from "./group-menu";
import { SkillPackageBuilder_Group_Contents_List } from "./group-contents";

export default function SkillPackageBuilder_Group_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]`>,
) {
    const { slug, package_id, group_id } = use(props.params);

    const organization = useOrganization();
    const skillGroup = useSkillGroup({
        skillPackageId: package_id,
        skillGroupId: group_id,
    });

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
                    <Hermes.Header>
                        <Hermes.BackButton
                            to={
                                Paths.org(
                                    slug,
                                ).skillPackageBuilder.skillPackage(package_id)
                                    .index
                            }
                            tooltip={`Back to package: ${skillGroup.skillPackage.name}`}
                        />
                        <Hermes.Title>{skillGroup.name}</Hermes.Title>
                        <Hermes.Action>
                            <SkillPackageBuilder_Group_Menu
                                skillGroup={skillGroup}
                            />
                        </Hermes.Action>
                    </Hermes.Header>
                    <Card>
                        <CardHeader>
                            <CardTitle>Skill Group Details</CardTitle>

                            <CardAction>
                                <Protect
                                    orgId={organization.id}
                                    permissions={{ organization: ["update"] }}
                                >
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        tooltip="Edit skill group"
                                        asChild
                                    >
                                        <Link
                                            to={
                                                Paths.org(slug)
                                                    .skillPackageBuilder.skillPackage(
                                                        package_id,
                                                    )
                                                    .group(group_id).update
                                            }
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
                                        value={skillGroup.description ?? "-"}
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
                                    />
                                </Field>
                            </FieldGroup>
                        </CardContent>
                    </Card>

                    <SkillPackageBuilder_Group_Contents_List
                        skillGroup={skillGroup}
                        skillPackage={skillGroup.skillPackage}
                    />
                </Lexington.Column>
            </Lexington.Page>
        </Lexington.Root>
    );
}
