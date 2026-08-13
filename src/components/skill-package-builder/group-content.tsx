/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";

import { useOrganization } from "@/hooks/use-organization";
import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime";
import { route } from "@/lib/routes";
import { SkillGroupId } from "@/lib/schemas/skill-group";
import { trpc } from "@/trpc/client";

import { SkillPackageBuilder_Group_Contents_List } from "./group-contents";
import { SkillPackageBuilder_Group_Menu } from "./group-menu";
import { SkillPackageBuilder_UpdateGroup_Dialog } from "./update-group";

export function SkillPackageBuilder_Group_Content({ groupId }: { groupId: SkillGroupId }) {
    const organization = useOrganization();

    const { data: skillGroup } = useSuspenseQuery(
        trpc.skillPackageBuilder.getGroup.queryOptions({
            organizationId: organization.id,
            skillGroupId: groupId,
        }),
    );

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Skill Package Builder",
                        href: route("/orgs/[slug]/skill-package-builder", {
                            slug: organization.slug,
                        }),
                    },
                    {
                        label: skillGroup.skillPackage.name,
                        href: route("/orgs/[slug]/skill-package-builder/packages/[package_id]", {
                            slug: organization.slug,
                            package_id: skillGroup.skillPackageId,
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
                                        <Protect permissions={{ skillPackageBuilder: ["update"] }}>
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
                                                    "/orgs/[slug]/skill-package-builder/packages/[package_id]",
                                                    {
                                                        slug: organization.slug,
                                                        package_id: skillGroup.skillPackageId,
                                                    },
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
        </>
    );
}
