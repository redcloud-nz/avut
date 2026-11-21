/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { ArrowUpRightIcon } from "lucide-react";
import Link from "next/link";

import { useSuspenseQuery } from "@tanstack/react-query";

import { useSession } from "@/client/auth-queries";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { DataItem, DataItemTitle, DataItemValue, DataList } from "@/components/ui/data-item";
import { RecordCard, RecordCardId } from "@/components/ui/record-card";
import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { UserId } from "@/lib/schemas/user";
import { AdminModule_UpdateUser_Dialog } from "@/modules/org-admin/components/users/update-user";
import { AdminModule_User_Menu } from "@/modules/org-admin/components/users/user-menu";
import { AdminModule_UserTeams_Card } from "@/modules/org-admin/components/users/user-teams-card";
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
                            <RecordCard
                                label="User"
                                action={
                                    <Protect permissions={{ member: ["update"] }}>
                                        <AdminModule_UpdateUser_Dialog organizationUser={member} />
                                    </Protect>
                                }
                            >
                                <CardContent>
                                    <DataList>
                                        <RecordCardId label="User ID" id={member.user.id} />
                                        <DataItem>
                                            <DataItemTitle>Name</DataItemTitle>
                                            <DataItemValue>{member.user.name}</DataItemValue>
                                        </DataItem>
                                        <DataItem>
                                            <DataItemTitle>Email</DataItemTitle>
                                            <DataItemValue>{member.user.email}</DataItemValue>
                                        </DataItem>
                                        <DataItem>
                                            <DataItemTitle>Roles</DataItemTitle>
                                            <DataItemValue>
                                                {OrganizationRole.formatList(member.role)}
                                            </DataItemValue>
                                        </DataItem>
                                    </DataList>
                                </CardContent>
                            </RecordCard>
                            {linkedPerson && (
                                <RecordCard
                                    label="Linked Person"
                                    updatedAt={linkedPerson.updatedAt}
                                    historyHref={route(
                                        "/orgs/[slug]/admin/personnel/[person_id]/history",
                                        { slug, person_id: linkedPerson.id },
                                    )}
                                    action={
                                        <Button variant="ghost" size="icon" asChild>
                                            <Link
                                                href={route(
                                                    "/orgs/[slug]/admin/personnel/[person_id]",
                                                    { slug, person_id: linkedPerson.id },
                                                )}
                                                aria-label="Open person"
                                                title="Open person"
                                            >
                                                <ArrowUpRightIcon />
                                            </Link>
                                        </Button>
                                    }
                                >
                                    <CardContent>
                                        <DataList>
                                            <RecordCardId label="Person ID" id={linkedPerson.id} />
                                            <DataItem>
                                                <DataItemTitle>Name</DataItemTitle>
                                                <DataItemValue>{linkedPerson.name}</DataItemValue>
                                            </DataItem>
                                            <DataItem>
                                                <DataItemTitle>Email</DataItemTitle>
                                                <DataItemValue>{linkedPerson.email}</DataItemValue>
                                            </DataItem>
                                            {linkedPerson.status !== "Active" && (
                                                <DataItem>
                                                    <DataItemTitle>Status</DataItemTitle>
                                                    <DataItemValue>
                                                        {linkedPerson.status}
                                                    </DataItemValue>
                                                </DataItem>
                                            )}
                                        </DataList>
                                    </CardContent>
                                </RecordCard>
                            )}
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <AdminModule_UserTeams_Card userId={userId} />
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
        </>
    );
}
