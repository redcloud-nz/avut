/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import React from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDateDetails, DLDetails, DLTerm } from "@/components/ui/description-list";

import { type ModuleId, Modules } from "@/lib/modules";
import { route } from "@/lib/routes";
import { OrganizationId } from "@/lib/schemas/organization";
import { trpc } from "@/trpc/client";

import { SystemAdmin_AddMember_Dialog } from "./add-member-dialog";
import { SystemAdmin_MemberActionsMenu } from "./member-actions-menu";

export function SystemAdmin_Organization_Content({
    organizationId,
}: {
    organizationId: OrganizationId;
}) {
    const { data: organization } = useSuspenseQuery(
        trpc.systemAdmin.getOrganization.queryOptions({ organizationId }),
    );

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "System Admin", href: "/system-admin" },
                    { label: "Organizations", href: "/system-admin/organizations" },
                    { label: organization.name },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{organization.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <Button asChild variant="outline">
                                <Link
                                    href={route(
                                        "/system-admin/organizations/[organizationId]/settings",
                                        { organizationId },
                                    )}
                                >
                                    Settings
                                </Link>
                            </Button>
                            <Button asChild variant="outline">
                                <Link
                                    href={route("/orgs/[slug]/admin", { slug: organization.slug })}
                                >
                                    Open in-org admin
                                </Link>
                            </Button>
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
                                        <DLTerm>Organization ID</DLTerm>
                                        <DLDetails className="font-mono">
                                            {organization.id}
                                        </DLDetails>
                                        <DLTerm>Name</DLTerm>
                                        <DLDetails>{organization.name}</DLDetails>
                                        <DLTerm>Slug</DLTerm>
                                        <DLDetails className="font-mono">
                                            {organization.slug}
                                        </DLDetails>
                                        <DLTerm>Created</DLTerm>
                                        <DLDateDetails date={organization.createdAt} />
                                    </DL>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Members</CardTitle>
                                    <div className="ml-auto">
                                        <SystemAdmin_AddMember_Dialog
                                            organizationId={organizationId}
                                            memberUserIds={organization.members.map(
                                                (m) => m.userId,
                                            )}
                                        />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {organization.members.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No members.</p>
                                    ) : (
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-muted-foreground">
                                                    <th className="py-1 pr-4 font-medium">Name</th>
                                                    <th className="py-1 pr-4 font-medium">Email</th>
                                                    <th className="py-1 font-medium">Role</th>
                                                    <th className="py-1" />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {organization.members.map((member) => (
                                                    <tr key={member.userId} className="border-t">
                                                        <td className="py-1 pr-4">
                                                            <Link
                                                                href={route(
                                                                    "/system-admin/users/[user_id]",
                                                                    { user_id: member.userId },
                                                                )}
                                                                className="underline-offset-2 hover:underline"
                                                            >
                                                                {member.name}
                                                            </Link>
                                                        </td>
                                                        <td className="py-1 pr-4">
                                                            {member.email}
                                                        </td>
                                                        <td className="py-1">
                                                            <Badge variant="secondary">
                                                                {member.role}
                                                            </Badge>
                                                        </td>
                                                        <td className="py-1 text-right">
                                                            <SystemAdmin_MemberActionsMenu
                                                                organizationId={organizationId}
                                                                member={member}
                                                            />
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Teams</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {organization.teams.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No teams.</p>
                                    ) : (
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-muted-foreground">
                                                    <th className="py-1 pr-4 font-medium">Name</th>
                                                    <th className="py-1 font-medium">Members</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {organization.teams.map((team) => (
                                                    <tr key={team.id} className="border-t">
                                                        <td className="py-1 pr-4">{team.name}</td>
                                                        <td className="py-1">{team.memberCount}</td>
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
                                <CardHeader>
                                    <CardTitle>Enabled Modules</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {organization.enabledModules.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            No modules enabled.
                                        </p>
                                    ) : (
                                        <div className="flex flex-wrap gap-1">
                                            {organization.enabledModules.map(
                                                (moduleId: ModuleId) => (
                                                    <Badge key={moduleId} variant="secondary">
                                                        {Modules[moduleId].label}
                                                    </Badge>
                                                ),
                                            )}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent>
                                    <DL>
                                        <DLTerm>D4H access tokens</DLTerm>
                                        <DLDetails>{organization.d4hTokenCount}</DLDetails>
                                    </DL>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Record Counts</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <DL>
                                        {Object.entries(organization.recordCounts).map(
                                            ([key, count]) => (
                                                <React.Fragment key={key}>
                                                    <DLTerm>{key}</DLTerm>
                                                    <DLDetails>{count}</DLDetails>
                                                </React.Fragment>
                                            ),
                                        )}
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
