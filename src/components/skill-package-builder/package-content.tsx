/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";

import { useOrganization } from "@/hooks/use-organization";
import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime";
import { route } from "@/lib/routes";
import { SkillPackageId } from "@/lib/schemas/skill-package";
import { trpc } from "@/trpc/client";

import { SkillPackageBuilder_Package_Contents_List } from "./package-contents";
import { SkillPackageBuilder_Package_Menu } from "./package-menu";
import { SkillPackageBuilder_UpdatePackage_Dialog } from "./update-package";

export function SkillPackageBuilder_Package_Content({
    skillPackageId,
}: {
    skillPackageId: SkillPackageId;
}) {
    const organization = useOrganization();

    const { data: skillPackage } = useSuspenseQuery(
        trpc.skillPackageBuilder.getPackage.queryOptions({
            organizationId: organization.id,
            skillPackageId,
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
                    skillPackage.name,
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{skillPackage.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <SkillPackageBuilder_Package_Menu skillPackage={skillPackage} />
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Package Details</CardTitle>
                                    <CardAction>
                                        <Protect permissions={{ skillPackageBuilder: ["update"] }}>
                                            <SkillPackageBuilder_UpdatePackage_Dialog
                                                skillPackage={skillPackage}
                                            />
                                        </Protect>
                                    </CardAction>
                                </CardHeader>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Package ID</DLTerm>
                                        <DLDetails>{skillPackage.id}</DLDetails>
                                        <DLTerm>Name</DLTerm>
                                        <DLDetails>{skillPackage.name}</DLDetails>
                                        <DLTerm>Description</DLTerm>
                                        <DLDetails>{skillPackage.description}</DLDetails>
                                        <DLTerm>Status</DLTerm>
                                        <DLDetails>{skillPackage.status}</DLDetails>
                                        <DLTerm>Published</DLTerm>
                                        <DLDetails>
                                            {skillPackage.published ? "Yes" : "No"}
                                        </DLDetails>
                                    </DL>
                                </CardContent>
                            </Card>
                            <SkillPackageBuilder_Package_Contents_List
                                skillPackage={skillPackage}
                            />
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Created</DLTerm>
                                        <DLDetails>
                                            <div>{formatDateTime(skillPackage.createdAt)}</div>
                                            <div className="text-muted-foreground">
                                                {formatRelativeDateTime(skillPackage.createdAt)}
                                            </div>
                                        </DLDetails>
                                        <DLTerm>Updated</DLTerm>
                                        <DLDetails>
                                            <div>{formatDateTime(skillPackage.updatedAt)}</div>
                                            <div className="text-muted-foreground">
                                                {formatRelativeDateTime(skillPackage.updatedAt)}
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
