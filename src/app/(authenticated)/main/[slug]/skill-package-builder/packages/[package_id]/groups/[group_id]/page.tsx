/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]
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
import { useSkillGroup } from "@/hooks/use-skill-group";
import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime";
import { route } from "@/lib/routes";

import { SkillPackageBuilder_Group_Contents_List } from "./group-contents";
import { SkillPackageBuilder_Group_Menu } from "./group-menu";
import { SkillPackageBuilder_UpdateGroup_Dialog } from "./update-group";

export default function SkillPackageBuilder_Group_Page(
    props: PageProps<`/main/[slug]/skill-package-builder/packages/[package_id]/groups/[group_id]`>,
) {
    const { slug, package_id, group_id } = use(props.params);

    const organization = useOrganization();
    const skillGroup = useSkillGroup({
        skillPackageId: package_id,
        skillGroupId: group_id,
    });

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Skill Package Builder",
                        href: route("/main/[slug]/skill-package-builder", { slug }),
                    },
                    {
                        label: skillGroup.skillPackage!.name,
                        href: route("/main/[slug]/skill-package-builder/packages/[package_id]", {
                            slug,
                            package_id,
                        }),
                    },
                    "Groups",
                    skillGroup.name,
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{skillGroup.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <SkillPackageBuilder_Group_Menu skillGroup={skillGroup} />
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Skill Group Details</CardTitle>
                                    <CardAction>
                                        <Protect
                                            orgId={organization.id}
                                            permissions={{ skillPackageBuilder: ["update"] }}
                                        >
                                            <SkillPackageBuilder_UpdateGroup_Dialog
                                                skillGroup={skillGroup}
                                            />
                                        </Protect>
                                    </CardAction>
                                </CardHeader>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Group ID</DLTerm>
                                        <DLDetails>{skillGroup.id}</DLDetails>
                                        <DLTerm>Package</DLTerm>
                                        <DLDetails>
                                            <Link
                                                href={route(
                                                    "/main/[slug]/skill-package-builder/packages/[package_id]",
                                                    { slug, package_id },
                                                )}
                                            >
                                                {skillGroup.skillPackage.name}
                                            </Link>
                                        </DLDetails>
                                        <DLTerm>Name</DLTerm>
                                        <DLDetails>{skillGroup.name}</DLDetails>
                                        <DLTerm>Description</DLTerm>
                                        <DLDetails>{skillGroup.description ?? "-"}</DLDetails>
                                        <DLTerm>Status</DLTerm>
                                        <DLDetails>{skillGroup.status}</DLDetails>
                                    </DL>
                                </CardContent>
                            </Card>
                            <SkillPackageBuilder_Group_Contents_List
                                skillGroup={skillGroup}
                                skillPackage={skillGroup.skillPackage}
                            />
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Created</DLTerm>
                                        <DLDetails>
                                            <div>{formatDateTime(skillGroup.createdAt)}</div>
                                            <div className="text-muted-foreground">
                                                {formatRelativeDateTime(skillGroup.createdAt)}
                                            </div>
                                        </DLDetails>
                                        <DLTerm>Updated</DLTerm>
                                        <DLDetails>
                                            <div>{formatDateTime(skillGroup.updatedAt)}</div>
                                            <div className="text-muted-foreground">
                                                {formatRelativeDateTime(skillGroup.updatedAt)}
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
