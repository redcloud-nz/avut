/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]
 */
"use client";

import Link from "next/link";
import { use } from "react";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";

import { useOrganization } from "@/hooks/use-organization";
import { useSkill } from "@/hooks/use-skill";
import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime";
import { route } from "@/lib/routes";

import { SkillPackageBuilder_Skill_Menu } from "./skill-menu";
import { SkillPackageBuilder_UpdateSkill_Dialog } from "./update-skill";

export default function SkillPackageBuilder_Skill_Page(
    props: PageProps<`/orgs/[slug]/skill-package-builder/packages/[package_id]/skills/[skill_id]`>,
) {
    const { slug, package_id, skill_id } = use(props.params);

    const organization = useOrganization();
    const skill = useSkill({
        skillPackageId: package_id,
        skillId: skill_id,
    });

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Skill Package Builder",
                        href: route("/orgs/[slug]/skill-package-builder", { slug }),
                    },
                    {
                        label: skill.skillPackage.name,
                        href: route("/orgs/[slug]/skill-package-builder/packages/[package_id]", {
                            slug,
                            package_id,
                        }),
                    },
                    "Skills",
                    skill.name,
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{skill.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <SkillPackageBuilder_Skill_Menu skill={skill} />
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Skill Details</CardTitle>
                                    <CardAction>
                                        <Protect
                                            orgId={organization.id}
                                            permissions={{ skillPackageBuilder: ["update"] }}
                                        >
                                            <SkillPackageBuilder_UpdateSkill_Dialog skill={skill} />
                                        </Protect>
                                    </CardAction>
                                </CardHeader>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Skill ID</DLTerm>
                                        <DLDetails>{skill.id}</DLDetails>
                                        <DLTerm>Package</DLTerm>
                                        <DLDetails>
                                            <Link
                                                href={route(
                                                    "/orgs/[slug]/skill-package-builder/packages/[package_id]",
                                                    { slug, package_id },
                                                )}
                                            >
                                                {skill.skillPackage.name}
                                            </Link>
                                        </DLDetails>
                                        <DLTerm>Group</DLTerm>
                                        <DLDetails>
                                            {skill.skillGroup ? (
                                                <Link
                                                    href={route(
                                                        "/orgs/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]",
                                                        {
                                                            slug,
                                                            package_id,
                                                            group_id: skill.skillGroup.id,
                                                        },
                                                    )}
                                                >
                                                    {skill.skillGroup.name}
                                                </Link>
                                            ) : (
                                                ""
                                            )}
                                        </DLDetails>
                                        <DLTerm>Name</DLTerm>
                                        <DLDetails>{skill.name}</DLDetails>
                                        <DLTerm>Description</DLTerm>
                                        <DLDetails>{skill.description}</DLDetails>
                                        <DLTerm>Required</DLTerm>
                                        <DLDetails>
                                            {skill.defaultRequired ? "Yes" : "No"}
                                        </DLDetails>
                                        <DLTerm>Revalidation Frequency</DLTerm>
                                        <DLDetails>
                                            {skill.frequency ? `${skill.frequency} months` : "None"}
                                        </DLDetails>
                                        <DLTerm>Status</DLTerm>
                                        <DLDetails>{skill.status}</DLDetails>
                                    </DL>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Created</DLTerm>
                                        <DLDetails>
                                            <div>{formatDateTime(skill.createdAt)}</div>
                                            <div className="text-muted-foreground">
                                                {formatRelativeDateTime(skill.createdAt)}
                                            </div>
                                        </DLDetails>
                                        <DLTerm>Updated</DLTerm>
                                        <DLDetails>
                                            <div>{formatDateTime(skill.updatedAt)}</div>
                                            <div className="text-muted-foreground">
                                                {formatRelativeDateTime(skill.updatedAt)}
                                            </div>
                                        </DLDetails>
                                    </DL>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </Std.SidebarInset>
    );
}
