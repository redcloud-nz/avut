/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { ObjectIcons } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DataItem,
    DataItemDateValue,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
import { route } from "@/lib/routes";
import {
    OrganizationGroupId,
    OrganizationGroupMembershipStatus,
    OrganizationGroupRole,
} from "@/lib/schemas/organization-group";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

import { SystemAdmin_AddGroupMember_Dialog } from "./add-group-member-dialog";
import { SystemAdmin_DeleteGroup_Dialog } from "./delete-group-dialog";
import { SystemAdmin_EditGroup_Dialog } from "./edit-group-dialog";
import { SystemAdmin_GroupMemberActionsMenu } from "./group-member-actions-menu";

export function SystemAdmin_Group_Content({ groupId }: { groupId: OrganizationGroupId }) {
    const { data: group } = useSuspenseQuery(
        trpc.organizationGroups.getGroup.queryOptions({ groupId }),
    );

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["delete"] as const));

    const activeOrganizationIds = group.memberships
        .filter((m) => m.status === "Active")
        .map((m) => m.organization.id);

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "System Admin", href: "/system/admin" },
                    { label: "Groups", href: "/system/admin/groups" },
                    { label: group.name },
                ]}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{group.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <SystemAdmin_EditGroup_Dialog group={group} />
                            <Button
                                variant="outline"
                                onClick={() => void setAction("delete", { history: "push" })}
                            >
                                <ObjectIcons.Delete />
                                <span className="hidden md:inline">Delete</span>
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
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Group ID</DataItemTitle>
                                            <DataItemValue className="font-mono">
                                                {group.id}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Name</DataItemTitle>
                                            <DataItemValue>{group.name}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Slug</DataItemTitle>
                                            <DataItemValue className="font-mono">
                                                {group.slug}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Created</DataItemTitle>
                                            <DataItemDateValue date={group.createdAt} />
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Members</CardTitle>
                                    <div className="ml-auto">
                                        <SystemAdmin_AddGroupMember_Dialog
                                            groupId={group.id}
                                            activeOrganizationIds={activeOrganizationIds}
                                        />
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {group.memberships.length === 0 ? (
                                        <p className="text-sm text-muted-foreground">No members.</p>
                                    ) : (
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-muted-foreground">
                                                    <th className="py-1 pr-4 font-medium">
                                                        Organisation
                                                    </th>
                                                    <th className="py-1 pr-4 font-medium">Role</th>
                                                    <th className="py-1 font-medium">Membership</th>
                                                    <th className="py-1" />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {group.memberships.map((membership) => {
                                                    const active = membership.status === "Active";
                                                    return (
                                                        <tr
                                                            key={membership.id}
                                                            className={cn(
                                                                "border-t",
                                                                !active && "text-muted-foreground",
                                                            )}
                                                        >
                                                            <td className="py-1 pr-4">
                                                                <Link
                                                                    href={route(
                                                                        "/system/admin/organizations/[organizationId]",
                                                                        {
                                                                            organizationId:
                                                                                membership
                                                                                    .organization
                                                                                    .id,
                                                                        },
                                                                    )}
                                                                >
                                                                    {membership.organization.name}
                                                                </Link>
                                                            </td>
                                                            <td className="py-1 pr-4">
                                                                {
                                                                    OrganizationGroupRole
                                                                        .displayNames[
                                                                        membership.role
                                                                    ]
                                                                }
                                                            </td>
                                                            <td className="py-1">
                                                                <Badge
                                                                    variant={
                                                                        active
                                                                            ? "secondary"
                                                                            : "outline"
                                                                    }
                                                                >
                                                                    {
                                                                        OrganizationGroupMembershipStatus
                                                                            .displayNames[
                                                                            membership.status
                                                                        ]
                                                                    }
                                                                </Badge>
                                                            </td>
                                                            <td className="py-1 text-right">
                                                                <SystemAdmin_GroupMemberActionsMenu
                                                                    group={group}
                                                                    membership={membership}
                                                                />
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>

            <SystemAdmin_DeleteGroup_Dialog
                group={group}
                open={action === "delete"}
                onOpenChange={(open) =>
                    void setAction(open ? "delete" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
        </>
    );
}
