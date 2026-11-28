/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import Link from "next/link";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { route } from "@/lib/routes";
import {
    OrganizationGroupId,
    OrganizationGroupMembershipStatus,
    OrganizationGroupRole,
} from "@/lib/schemas/organization-group";
import { cn } from "@/lib/utils";
import { trpc } from "@/trpc/client";

import { SystemAdmin_AddGroupMember_Dialog } from "./add-group-member-dialog";
import { SystemAdmin_EditGroup_Dialog } from "./edit-group-dialog";
import { SystemAdmin_GroupMemberActionsMenu } from "./group-member-actions-menu";
import { SystemAdmin_Group_Menu } from "./group-menu";

export function SystemAdmin_Group_Content({ groupId }: { groupId: OrganizationGroupId }) {
    const { data: group } = useSuspenseQuery(
        trpc.organizationGroups.getGroup.queryOptions({ groupId }),
    );

    const activeOrganizationIds = group.memberships
        .filter((m) => m.status === "Active")
        .map((m) => m.organization.id);

    return (
        <Saratoga.Root>
            <Saratoga.Breadcrumbs items={[{ label: "Groups", href: "/system/admin/groups" }]} />
            <Saratoga.Header>
                <Saratoga.Title>{group.name}</Saratoga.Title>
            </Saratoga.Header>

            {/* Nothing for a secondary column: full width. */}
            <div className="space-y-4">
                <RecordCard
                    label="Group"
                    updatedAt={group.updatedAt}
                    action={
                        <>
                            <SystemAdmin_EditGroup_Dialog group={group} primary />
                            <SystemAdmin_Group_Menu group={group} />
                        </>
                    }
                >
                    <CardContent>
                        <DataList>
                            <RecordCardId label="Group ID" id={group.id} />
                            <DataItem>
                                <DataItemTitle>Name</DataItemTitle>
                                <DataItemValue>{group.name}</DataItemValue>
                            </DataItem>
                            <DataItem>
                                <DataItemTitle>Slug</DataItemTitle>
                                <DataItemValue className="font-mono">{group.slug}</DataItemValue>
                            </DataItem>
                        </DataList>
                    </CardContent>
                </RecordCard>

                <Card>
                    <CardHeader>
                        <CardTitle>Members</CardTitle>
                        <CardAction>
                            <SystemAdmin_AddGroupMember_Dialog
                                groupId={group.id}
                                activeOrganizationIds={activeOrganizationIds}
                            />
                        </CardAction>
                    </CardHeader>
                    <CardContent>
                        {group.memberships.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No members.</p>
                        ) : (
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-muted-foreground">
                                        <th className="py-1 pr-4 font-medium">Organisation</th>
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
                                                                    membership.organization.id,
                                                            },
                                                        )}
                                                    >
                                                        {membership.organization.name}
                                                    </Link>
                                                </td>
                                                <td className="py-1 pr-4">
                                                    {
                                                        OrganizationGroupRole.displayNames[
                                                            membership.role
                                                        ]
                                                    }
                                                </td>
                                                <td className="py-1">
                                                    <Badge
                                                        variant={active ? "secondary" : "outline"}
                                                    >
                                                        {
                                                            OrganizationGroupMembershipStatus
                                                                .displayNames[membership.status]
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
            </div>
        </Saratoga.Root>
    );
}
