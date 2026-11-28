/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { useId } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { Saratoga } from "@/components/blocks/saratoga";
import { CardContent } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import {
    Item,
    ItemActions,
    ItemContent,
    ItemDescription,
    ItemGroup,
    ItemTitle,
} from "@/components/ui/item";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { UserBanStatusBadge } from "@/components/ui/status-badge";
import { route } from "@/lib/routes";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { UserId } from "@/lib/schemas/user";
import {
    SystemAdmin_User_ActionsCard,
    SystemAdmin_UserActions_Menu,
} from "@/modules/system-admin/components/users/user-actions-menu";
import { trpc } from "@/trpc/client";

export function SystemAdmin_User_Content({ userId }: { userId: UserId }) {
    const { data: user } = useSuspenseQuery(trpc.users.getUser.queryOptions({ userId }));
    const organizationsHeadingId = useId();

    return (
        <Saratoga.Root>
            <Saratoga.Breadcrumbs items={[{ label: "Users", href: "/system/admin/users" }]} />
            <Saratoga.Header>
                <Saratoga.Title badges={<UserBanStatusBadge banned={user.banned} />}>
                    {user.name}
                </Saratoga.Title>
            </Saratoga.Header>

            <Saratoga.Columns>
                <Saratoga.Column slot="main">
                    <RecordCard label="User" action={<SystemAdmin_UserActions_Menu user={user} />}>
                        <CardContent>
                            <DataList>
                                <RecordCardId label="User ID" id={user.id} />
                                <DataItem>
                                    <DataItemTitle>Name</DataItemTitle>
                                    <DataItemValue>{user.name}</DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Email</DataItemTitle>
                                    <DataItemValue>{user.email}</DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>Email verified</DataItemTitle>
                                    <DataItemValue>
                                        {user.emailVerified ? "Yes" : "No"}
                                    </DataItemValue>
                                </DataItem>
                                <DataItem>
                                    <DataItemTitle>System role</DataItemTitle>
                                    <DataItemValue>{user.role}</DataItemValue>
                                </DataItem>
                            </DataList>
                        </CardContent>
                    </RecordCard>
                </Saratoga.Column>

                <Saratoga.Column slot="secondary">
                    <SystemAdmin_User_ActionsCard user={user} />
                    <section aria-labelledby={organizationsHeadingId} className="space-y-2">
                        <div className="flex min-h-8 items-center justify-between gap-2 pl-1">
                            <h2 id={organizationsHeadingId} className="text-base font-medium">
                                Organisations
                            </h2>
                        </div>
                        {user.organizations.length === 0 ? (
                            <p className="pl-1 text-sm text-muted-foreground">
                                No organisation memberships.
                            </p>
                        ) : (
                            <ItemGroup className="gap-2">
                                {user.organizations.map((org) => (
                                    <Item key={org.id} variant="outline" role="listitem" asChild>
                                        <Link
                                            href={route(
                                                "/system/admin/organizations/[organizationId]",
                                                { organizationId: org.id },
                                            )}
                                        >
                                            <ItemContent>
                                                <ItemTitle>{org.name}</ItemTitle>
                                                <ItemDescription>
                                                    {OrganizationRole.formatList(org.role)}
                                                </ItemDescription>
                                            </ItemContent>
                                            <ItemActions>
                                                <ChevronRightIcon
                                                    aria-hidden
                                                    className="size-4 text-muted-foreground"
                                                />
                                            </ItemActions>
                                        </Link>
                                    </Item>
                                ))}
                            </ItemGroup>
                        )}
                    </section>
                </Saratoga.Column>
            </Saratoga.Columns>
        </Saratoga.Root>
    );
}
