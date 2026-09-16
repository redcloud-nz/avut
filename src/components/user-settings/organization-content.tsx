/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDateDetails, DLDetails, DLTerm } from "@/components/ui/description-list";

import { OrganizationRole } from "@/lib/schemas/organization-role";
import { OrganizationId } from "@/lib/schemas/organization";
import { trpc } from "@/trpc/client";

import { UserSettings_OrganizationMenu } from "./organization-menu";

export function UserSettings_OrganizationContent({
    organizationId,
}: {
    organizationId: OrganizationId;
}) {
    const { data: memberships } = useSuspenseQuery(trpc.users.listMemberships.queryOptions());
    const membership = memberships.find((m) => m.organization.id === organizationId);

    if (!membership) return null;

    const { organization } = membership;

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "User Settings", href: "/user/settings" },
                    { label: "Organisations", href: "/user/settings/organizations" },
                    organization.name,
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{organization.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <UserSettings_OrganizationMenu membership={membership} />
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Organisation</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Name</DLTerm>
                                        <DLDetails>{organization.name}</DLDetails>
                                        <DLTerm>Slug</DLTerm>
                                        <DLDetails>{organization.slug}</DLDetails>
                                        <DLTerm>Your Roles</DLTerm>
                                        <DLDetails>
                                            <div className="flex flex-wrap gap-1">
                                                {membership.roles.map((role) => (
                                                    <Badge key={role} variant="secondary">
                                                        {OrganizationRole.displayNames[role]}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </DLDetails>
                                    </DL>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Joined</DLTerm>
                                        <DLDateDetails date={membership.createdAt} />
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
