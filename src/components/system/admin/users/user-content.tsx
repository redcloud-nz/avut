/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { SystemAdmin_UserActions_Menu } from "@/components/system/admin/users/user-actions-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DataItem,
    DataItemDateValue,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
import { route } from "@/lib/routes";
import { UserId } from "@/lib/schemas/user";
import { trpc } from "@/trpc/client";

export function SystemAdmin_User_Content({ userId }: { userId: UserId }) {
    const { data: user } = useSuspenseQuery(trpc.users.getUser.queryOptions({ userId }));

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "System Admin", href: "/system/admin" },
                    { label: "Users", href: "/system/admin/users" },
                    { label: user.name },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{user.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <SystemAdmin_UserActions_Menu user={user} />
                        </Saratoga.Actions>
                    </Saratoga.Header>

                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Identity</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>User ID</DataItemTitle>
                                            <DataItemValue className="font-mono">
                                                {user.id}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Name</DataItemTitle>
                                            <DataItemValue>{user.name}</DataItemValue>
                                        </DataItem>
                                        <DataItem>
                                            <DataItemTitle>Email</DataItemTitle>
                                            <DataItemValue>{user.email}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Email verified</DataItemTitle>
                                            <DataItemValue>
                                                {user.emailVerified ? "Yes" : "No"}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>System role</DataItemTitle>
                                            <DataItemValue>{user.role}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Status</DataItemTitle>
                                            <DataItemValue>
                                                {user.banned ? "Banned" : "Active"}
                                            </DataItemValue>
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Organisation Memberships</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {user.organizations.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            No organisation memberships.
                                        </p>
                                    ) : (
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-muted-foreground">
                                                    <th className="py-1 pr-4 font-medium">
                                                        Organisation
                                                    </th>
                                                    <th className="py-1 pr-4 font-medium">Slug</th>
                                                    <th className="py-1 font-medium">Role</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {user.organizations.map((org) => (
                                                    <tr key={org.id} className="border-t">
                                                        <td className="py-1 pr-4">
                                                            <Link
                                                                href={route(
                                                                    "/system/admin/organizations/[organizationId]",
                                                                    { organizationId: org.id },
                                                                )}
                                                                className="underline-offset-2 hover:underline"
                                                            >
                                                                {org.name}
                                                            </Link>
                                                        </td>
                                                        <td className="py-1 pr-4 font-mono text-xs">
                                                            {org.slug}
                                                        </td>
                                                        <td className="py-1">
                                                            <Badge variant="secondary">
                                                                {org.role}
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </CardContent>
                            </Card>
                        </Saratoga.Column>

                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Created</DataItemTitle>
                                            <DataItemDateValue date={user.createdAt} />
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
