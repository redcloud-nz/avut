/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import Link from "next/link";

import { useSuspenseQuery } from "@tanstack/react-query";

import { useSession } from "@/client/auth-queries";
import { AdminModule_UpdateUser_Dialog } from "@/components/admin/users/update-user";
import { AdminModule_User_Menu } from "@/components/admin/users/user-menu";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { HelpButton } from "@/components/docs/help-button";
import { Protect } from "@/components/protect";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DataItem,
    DataItemDateValue,
    DataItemTitle,
    DataItemValue,
    DataList,
} from "@/components/ui/data-item";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { UserId } from "@/lib/schemas/user";
import { trpc } from "@/trpc/client";

export function AdminModule_User_Content({ userId }: { userId: UserId }) {
    const organization = useOrganization();
    const slug = organization.slug;
    const { data: session } = useSession();

    const { data: members } = useSuspenseQuery(
        trpc.organizations.listMembers.queryOptions({ organizationId: organization.id }),
    );
    const member = members.find((m) => m.user.id === userId);
    if (!member)
        throw new Error(`User with ID ${userId} not found in organization ${organization.id}`);

    const { data: linkedPerson } = useSuspenseQuery(
        trpc.users.getLinkedPerson.queryOptions({
            organizationId: organization.id,
            userId,
        }),
    );

    return (
        <>
            <Std.Navbar
                breadcrumbs={[
                    { label: "Admin", href: route("/orgs/[slug]/admin", { slug }) },
                    { label: "Users", href: route("/orgs/[slug]/admin/users", { slug }) },
                    { label: member.user.name },
                ]}
                actions={<HelpButton id="admin" />}
            />
            <Std.ScrollContainer>
                <Saratoga.Root>
                    <Saratoga.Header>
                        <Saratoga.Title>{member.user.name}</Saratoga.Title>
                        <Saratoga.Actions>
                            <AdminModule_User_Menu
                                userId={userId}
                                member={member}
                                linkedPerson={linkedPerson}
                                currentUserId={session?.user.id}
                            />
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>User Details</CardTitle>
                                    <CardAction>
                                        <Protect permissions={{ member: ["update"] }}>
                                            <AdminModule_UpdateUser_Dialog
                                                organizationUser={member}
                                            />
                                        </Protect>
                                    </CardAction>
                                </CardHeader>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>User ID</DataItemTitle>
                                            <DataItemValue className="font-mono">
                                                {member.user.id}
                                            </DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Name</DataItemTitle>
                                            <DataItemValue>{member.user.name}</DataItemValue>
                                        </DataItem>
                                        <DataItem>
                                            <DataItemTitle>Email</DataItemTitle>
                                            <DataItemValue>{member.user.email}</DataItemValue>
                                        </DataItem>
                                        <DataItem inline>
                                            <DataItemTitle>Roles</DataItemTitle>
                                            <DataItemValue>
                                                {OrganizationRole.formatList(member.role)}
                                            </DataItemValue>
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </Card>
                            {linkedPerson && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Linked Person</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <DataList>
                                            <DataItem inline>
                                                <DataItemTitle>Person ID</DataItemTitle>
                                                <DataItemValue className="font-mono">
                                                    <Link
                                                        href={route(
                                                            "/orgs/[slug]/admin/personnel/[person_id]",
                                                            {
                                                                slug,
                                                                person_id: linkedPerson.id,
                                                            },
                                                        )}
                                                    >
                                                        {linkedPerson.id}
                                                    </Link>
                                                </DataItemValue>
                                            </DataItem>
                                            <DataItem inline>
                                                <DataItemTitle>Name</DataItemTitle>
                                                <DataItemValue>{linkedPerson.name}</DataItemValue>
                                            </DataItem>
                                            <DataItem>
                                                <DataItemTitle>Email</DataItemTitle>
                                                <DataItemValue>{linkedPerson.email}</DataItemValue>
                                            </DataItem>
                                            <DataItem inline>
                                                <DataItemTitle>Status</DataItemTitle>
                                                <DataItemValue>{linkedPerson.status}</DataItemValue>
                                            </DataItem>
                                        </DataList>
                                    </CardContent>
                                </Card>
                            )}
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardContent>
                                    <DataList>
                                        <DataItem inline>
                                            <DataItemTitle>Created</DataItemTitle>
                                            <DataItemDateValue date={member.createdAt} />
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
