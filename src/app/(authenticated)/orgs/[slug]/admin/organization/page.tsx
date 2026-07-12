/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/organization
 */

import Link from "next/link";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { ObjectIcons, SettingsIcon } from "@/components/icons";
import { Protect } from "@/components/protect";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";

import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime";
import { route } from "@/lib/routes";
import { getOrganizationBySlug } from "@/server/organization";

export default async function AdminModule_Organization_Page(
    props: PageProps<`/orgs/[slug]/admin/organization`>,
) {
    const { slug } = await props.params;
    const organization = await getOrganizationBySlug(slug);

    return (
        <Std.SidebarInset>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                    "Organization",
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>Organization</Saratoga.Title>
                        <Saratoga.Actions>
                            <Protect
                                orgId={organization.id}
                                permissions={{ organization: ["update"] }}
                            >
                                <Button variant="ghost" size="icon" asChild>
                                    <Link
                                        href={route("/orgs/[slug]/admin/organization/--update", {
                                            slug,
                                        })}
                                    >
                                        <ObjectIcons.Edit />
                                    </Link>
                                </Button>
                            </Protect>
                            <Protect
                                orgId={organization.id}
                                permissions={{ organization: ["update"] }}
                            >
                                <Button variant="outline" size="icon" asChild>
                                    <Link
                                        href={route("/orgs/[slug]/admin/organization/settings", {
                                            slug,
                                        })}
                                    >
                                        <SettingsIcon />
                                    </Link>
                                </Button>
                            </Protect>
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>{organization.name}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Organization ID</DLTerm>
                                        <DLDetails>{organization.id}</DLDetails>
                                        <DLTerm>Name</DLTerm>
                                        <DLDetails>{organization.name}</DLDetails>
                                        <DLTerm>Slug</DLTerm>
                                        <DLDetails>{organization.slug}</DLDetails>
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
                                            <div>{formatDateTime(organization.createdAt)}</div>
                                            <div className="text-muted-foreground">
                                                {formatRelativeDateTime(organization.createdAt)}
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
