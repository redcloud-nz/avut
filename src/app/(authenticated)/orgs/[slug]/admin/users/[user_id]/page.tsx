/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Paths: /orgs/[slug]/admin/users/[user_id]
 */

"use client";

import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { use } from "react";

import { useSuspenseQuery } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { useSession } from "@/client/auth-queries";
import { AdminModule_DeleteUser_Dialog } from "@/components/admin/users/delete-user";
import { AdminModule_LinkPerson_Dialog } from "@/components/admin/users/link-person";
import { AdminModule_UnlinkPerson_Dialog } from "@/components/admin/users/unlink-person";
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
import { UserId } from "@/lib/schemas/user";
import { trpc } from "@/trpc/client";

export default function AdminModule_User_Page(
    props: PageProps<"/orgs/[slug]/admin/users/[user_id]">,
) {
    const { slug, user_id } = use(props.params);

    const organization = useOrganization();
    const { data: session } = useSession();

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

    const userId = UserId.schema.parse(user_id);

    const { data: linkedPerson } = useSuspenseQuery(
        trpc.users.getLinkedPerson.queryOptions({
            organizationId: organization.id,
            userId,
        }),
    );

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["delete", "link-person", "unlink-person"] as const),
    );

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
                                            permissions={{ member: ["delete"] }}
                                            render={(allowed) => (
                                                <DropdownMenuItem
                                                    disabled={
                                                        !allowed ||
                                                        member.user.id === session?.user.id
                                                    }
                                                    onClick={() =>
                                                        setAction("delete", { history: "push" })
                                                    }
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
                                        <Protect permissions={{ member: ["update"] }}>
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
                            <Card>
                                <CardHeader>
                                    <CardTitle>Linked Person</CardTitle>
                                    <CardAction>
                                        <Protect permissions={{ member: ["update"] }}>
                                            {linkedPerson ? (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        setAction("unlink-person", {
                                                            history: "push",
                                                        })
                                                    }
                                                >
                                                    <ObjectIcons.Unlink />
                                                </Button>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        setAction("link-person", {
                                                            history: "push",
                                                        })
                                                    }
                                                >
                                                    <ObjectIcons.Link />
                                                </Button>
                                            )}
                                        </Protect>
                                    </CardAction>
                                </CardHeader>
                                <CardContent>
                                    {linkedPerson ? (
                                        <DL>
                                            <DLTerm>Person ID</DLTerm>
                                            <DLDetails className="font-mono">
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
                                            </DLDetails>
                                            <DLTerm>Name</DLTerm>
                                            <DLDetails>{linkedPerson.name}</DLDetails>
                                            <DLTerm>Email</DLTerm>
                                            <DLDetails>{linkedPerson.email}</DLDetails>
                                            <DLTerm>Status</DLTerm>
                                            <DLDetails>{linkedPerson.status}</DLDetails>
                                        </DL>
                                    ) : (
                                        <p className="text-muted-foreground text-sm">
                                            No linked person.
                                        </p>
                                    )}
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
                open={action === "delete"}
                onOpenChange={(open) =>
                    setAction(open ? "delete" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
            <AdminModule_LinkPerson_Dialog
                userId={userId}
                userName={member.user.name}
                open={action === "link-person"}
                onOpenChange={(open) =>
                    setAction(open ? "link-person" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
            {linkedPerson && (
                <AdminModule_UnlinkPerson_Dialog
                    userId={userId}
                    userName={member.user.name}
                    personName={linkedPerson.name}
                    open={action === "unlink-person"}
                    onOpenChange={(open) =>
                        setAction(open ? "unlink-person" : null, {
                            history: open ? "push" : "replace",
                        })
                    }
                />
            )}
        </Std.SidebarInset>
    );
}
