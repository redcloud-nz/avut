/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { notFound } from "next/navigation";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DataItem,
    DataItemDateValue,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { trpc } from "@/trpc/client";

import { UserSettings_Organization_Menu } from "./organization-menu";

export function UserSettings_OrganizationContent({
    organizationId,
}: {
    organizationId: OrganizationId;
}) {
    const { data: memberships } = useSuspenseQuery(trpc.user.listMemberships.queryOptions());
    const membership = memberships.find((m) => m.organization.id === organizationId);

    if (!membership) notFound();

    const { organization } = membership;

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    "User Settings",
                    { label: "Organisations", href: "/user/settings/organizations" },
                    organization.name,
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{organization.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <UserSettings_Organization_Menu membership={membership} />
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Organisation</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Name</DataItemTitle>
                                            <DataItemValue>{organization.name}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Slug</DataItemTitle>
                                            <DataItemValue>{organization.slug}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Your Roles</DataItemTitle>
                                            <DataItemValue>
                                                <div className="flex flex-wrap gap-1">
                                                    {membership.roles.map((role) => (
                                                        <Badge key={role} variant="secondary">
                                                            {OrganizationRole.displayNames[role]}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </DataItemValue>
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Joined</DataItemTitle>
                                            <DataItemDateValue date={membership.createdAt} />
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
