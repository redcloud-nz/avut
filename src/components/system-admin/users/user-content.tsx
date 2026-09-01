/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { SystemAdmin_UserActions_Menu } from "@/components/system-admin/users/user-actions-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDateDetails, DLDetails, DLTerm } from "@/components/ui/description-list";

import { UserId } from "@/lib/schemas/user";
import { trpc } from "@/trpc/client";

export function SystemAdmin_User_Content({ userId }: { userId: UserId }) {
    const { data: user } = useSuspenseQuery(trpc.systemAdmin.getUser.queryOptions({ userId }));

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "System Admin", href: "/system-admin" },
                    { label: "Users", href: "/system-admin/users" },
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
                                    <DL>
                                        <DLTerm>User ID</DLTerm>
                                        <DLDetails className="font-mono">{user.id}</DLDetails>
                                        <DLTerm>Name</DLTerm>
                                        <DLDetails>{user.name}</DLDetails>
                                        <DLTerm>Email</DLTerm>
                                        <DLDetails>{user.email}</DLDetails>
                                        <DLTerm>Email verified</DLTerm>
                                        <DLDetails>{user.emailVerified ? "Yes" : "No"}</DLDetails>
                                        <DLTerm>Role</DLTerm>
                                        <DLDetails>{user.role}</DLDetails>
                                        <DLTerm>Status</DLTerm>
                                        <DLDetails>{user.banned ? "Banned" : "Active"}</DLDetails>
                                    </DL>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Organization Memberships</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {user.organizations.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            No organization memberships.
                                        </p>
                                    ) : (
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-muted-foreground">
                                                    <th className="py-1 pr-4 font-medium">
                                                        Organization
                                                    </th>
                                                    <th className="py-1 pr-4 font-medium">Slug</th>
                                                    <th className="py-1 font-medium">Role</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {user.organizations.map((org) => (
                                                    <tr key={org.id} className="border-t">
                                                        {/* TODO(phase-5): link to org detail
                                                            (/system-admin/organizations/[organizationId]) */}
                                                        <td className="py-1 pr-4">{org.name}</td>
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
                                    <DL>
                                        <DLTerm>Created</DLTerm>
                                        <DLDateDetails date={user.createdAt} />
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
