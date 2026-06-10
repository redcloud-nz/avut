/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /main/[slug]/skill-package-builder/packages/[package_id]
 */
"use client";

import Link from "next/link";
import { use } from "react";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";

import { useOrganization } from "@/hooks/use-organization";
import { useSkillPackage } from "@/hooks/use-skill-package";
import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime";
import { route } from "@/lib/routes";

import { SkillPackageBuilder_Package_Contents_List } from "./package-contents";
import { SkillPackageBuilder_Package_Menu } from "./package-menu";

export default function SkillPackageBuilder_Package_Page(
    props: PageProps<`/main/[slug]/skill-package-builder/packages/[package_id]`>,
) {
    const { slug, package_id } = use(props.params);

    const organization = useOrganization();
    const skillPackage = useSkillPackage(package_id);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    {
                        label: "Skill Package Builder",
                        href: route("/main/[slug]/skill-package-builder", { slug }),
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
                                        <Protect
                                            orgId={organization.id}
                                            permissions={{ organization: ["update"] }}
                                        >
                                            <Button variant="ghost" size="icon" asChild>
                                                <Link
                                                    href={route(
                                                        "/main/[slug]/skill-package-builder/packages/[package_id]/--update",
                                                        { slug, package_id: skillPackage.id },
                                                    )}
                                                >
                                                    <ObjectIcons.Edit />
                                                </Link>
                                            </Button>
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
        </Std.SidebarInset>
    );
}
