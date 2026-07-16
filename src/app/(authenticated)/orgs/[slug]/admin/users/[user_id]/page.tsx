/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/users/[user_id]
 */

"use client";

import { use, useState } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { AdminModule_DeleteUser_Dialog } from "@/components/admin/users/delete-user";
import { AdminModule_UpdateUser_Dialog } from "@/components/admin/users/update-user";
import { Saratoga } from "@/components/blocks/saratoga";
import { Std } from "@/components/blocks/std";
import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDateDetails, DLDetails, DLTerm } from "@/components/ui/description-list";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
import { OrganizationRole } from "@/lib/schemas/organization-role";

export default function AdminModule_User_Page(
    props: PageProps<"/orgs/[slug]/admin/users/[user_id]">,
) {
    const { slug, user_id } = use(props.params);

    const organization = useOrganization();
    const { data: session } = authClient.useSession();

    const {
        data: { members },
    } = useSuspenseQuery({
        queryKey: ["auth", "organization-users", organization.id],
        queryFn: () =>
            authClient.organization.listMembers(
                { query: { organizationId: organization.id } },
                { throw: true },
            ),
    });
    const member = members.find((m) => m.user.id === user_id);
    if (!member)
        throw new Error(`User with ID ${user_id} not found in organization ${organization.id}`);

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    return (
        <Std.SidebarInset>
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
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <DropdownMenuTriggerIcon />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuGroup>
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <Protect
                                            orgId={organization.id}
                                            permissions={{ member: ["delete"] }}
                                            render={(allowed) => (
                                                <DropdownMenuItem
                                                    disabled={
                                                        !allowed ||
                                                        member.user.id === session?.user.id
                                                    }
                                                    onClick={() => setDeleteDialogOpen(true)}
                                                    className="text-destructive"
                                                >
                                                    <ObjectIcons.Delete /> Delete User
                                                </DropdownMenuItem>
                                            )}
                                        />
                                    </DropdownMenuGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </Saratoga.Actions>
                    </Saratoga.Header>
                    <Saratoga.Columns>
                        <Saratoga.Column slot="main">
                            <Card>
                                <CardHeader>
                                    <CardTitle>User Details</CardTitle>
                                    <CardAction>
                                        <Protect
                                            orgId={organization.id}
                                            permissions={{ member: ["update"] }}
                                        >
                                            <AdminModule_UpdateUser_Dialog
                                                organizationUser={member}
                                            />
                                        </Protect>
                                    </CardAction>
                                </CardHeader>
                                <CardContent>
                                    <DL>
                                        <DLTerm>User ID</DLTerm>
                                        <DLDetails className="font-mono">
                                            {member.user.id}
                                        </DLDetails>
                                        <DLTerm>Name</DLTerm>
                                        <DLDetails>{member.user.name}</DLDetails>
                                        <DLTerm>Email</DLTerm>
                                        <DLDetails>{member.user.email}</DLDetails>
                                        <DLTerm>Roles</DLTerm>
                                        <DLDetails>
                                            {OrganizationRole.formatList(member.role)}
                                        </DLDetails>
                                    </DL>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                        <Saratoga.Column slot="secondary">
                            <Card>
                                <CardContent>
                                    <DL>
                                        <DLTerm>Created</DLTerm>
                                        <DLDateDetails date={member.createdAt} />
                                    </DL>
                                </CardContent>
                            </Card>
                        </Saratoga.Column>
                    </Saratoga.Columns>
                </Saratoga.Root>
            </Std.ScrollContainer>
            <AdminModule_DeleteUser_Dialog
                organizationUser={member}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
        </Std.SidebarInset>
    );
}
