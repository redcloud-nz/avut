/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { SendIcon } from "lucide-react";
import { useState } from "react";
import { match } from "ts-pattern";

import { useSuspenseQuery } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Saratoga } from "@/components/blocks/saratoga";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DL, DLDetails, DLTerm } from "@/components/ui/description-list";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useOrganization } from "@/hooks/use-organization";
import { formatDateTime, formatRelativeDateTime } from "@/lib/datetime";
import { OrganizationRole } from "@/lib/schemas/organization-role";
import { PersonId } from "@/lib/schemas/person";
import { trpc, trpcClient } from "@/trpc/client";

import { AdminModule_DeleteUser_Dialog } from "./delete-user";
import { AdminModule_ResendInvitation_Dialog } from "./resend-invitation";
import { AdminModule_RevokeInvitation_Dialog } from "./revoke-invitation";
import { AdminModule_UpdateRoles_Dialog } from "./update-roles";

export function AdminModule_AccessControl_PersonAccessControl_Card({
    personId,
}: {
    personId: PersonId;
}) {
    const organization = useOrganization();

    const { data: session } = authClient.useSession();

    const { data: personnel } = useSuspenseQuery(
        trpc.accessControl.listPersonnelWithAccess.queryOptions({
            organizationId: organization.id,
        }),
    );

    const person = personnel.find((p) => p.id === personId);
    if (!person) throw new Error("Person not found");

    const currentUser = personnel.find((p) => p.user?.userId === session?.user.id)?.user;
    if (!currentUser) throw new Error("Current user not found in personnel");

    const [dialogOpen, setDialogOpen] = useState<
        "update" | "update-invitation" | "delete" | "resend" | "revoke" | false
    >(false);

    return match(person)
        .with({ accessStatus: "None" }, () => (
            <Saratoga.Root>
                <Saratoga.Header>
                    <Saratoga.Title>{person.name}</Saratoga.Title>
                </Saratoga.Header>
                <Card>
                    <CardHeader>
                        <CardTitle>Access</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground text-sm">
                            No access configured. Use the Invite button on the access control list
                            to invite this person.
                        </p>
                    </CardContent>
                </Card>
            </Saratoga.Root>
        ))
        .with({ accessStatus: "Invited" }, ({ invitation }) => (
            <Saratoga.Root>
                <Saratoga.Header>
                    <Saratoga.Title>{person.name}</Saratoga.Title>
                    <Saratoga.Actions>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                    <DropdownMenuTriggerIcon />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuGroup>
                                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                    <Protect
                                        orgId={organization.id}
                                        permissions={{ invitation: ["update"] }}
                                        render={(allowed) => (
                                            <>
                                                <DropdownMenuItem
                                                    disabled={!allowed}
                                                    onSelect={() => setDialogOpen("resend")}
                                                >
                                                    <SendIcon />
                                                    Resend
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    disabled={!allowed}
                                                    onSelect={() => setDialogOpen("revoke")}
                                                    className="text-destructive"
                                                >
                                                    <ObjectIcons.Delete />
                                                    Revoke
                                                </DropdownMenuItem>
                                            </>
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
                                <CardTitle>Access</CardTitle>
                                <CardAction>
                                    <Protect
                                        orgId={organization.id}
                                        permissions={{ invitation: ["update"] }}
                                    >
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() =>
                                                        setDialogOpen("update-invitation")
                                                    }
                                                >
                                                    <ObjectIcons.Edit />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Edit roles</TooltipContent>
                                        </Tooltip>
                                    </Protect>
                                </CardAction>
                            </CardHeader>
                            <CardContent>
                                <DL>
                                    <DLTerm>Status</DLTerm>
                                    <DLDetails>Invited</DLDetails>
                                    <DLTerm>Email</DLTerm>
                                    <DLDetails>{invitation.email}</DLDetails>
                                    <DLTerm>Role(s)</DLTerm>
                                    <DLDetails>
                                        {invitation.roles
                                            .map((r) => OrganizationRole.displayNames[r])
                                            .join(", ")}
                                    </DLDetails>
                                </DL>
                            </CardContent>
                        </Card>
                    </Saratoga.Column>
                    <Saratoga.Column slot="secondary">
                        <Card>
                            <CardContent>
                                <DL>
                                    <DLTerm>Sent</DLTerm>
                                    <DLDetails>
                                        <div>{formatDateTime(invitation.createdAt)}</div>
                                        <div className="text-muted-foreground">
                                            {formatRelativeDateTime(invitation.createdAt)}
                                        </div>
                                    </DLDetails>
                                    <DLTerm>Expires</DLTerm>
                                    <DLDetails>
                                        <div>{formatDateTime(invitation.expiresAt)}</div>
                                        <div className="text-muted-foreground">
                                            {formatRelativeDateTime(invitation.expiresAt)}
                                        </div>
                                    </DLDetails>
                                </DL>
                            </CardContent>
                        </Card>
                    </Saratoga.Column>
                </Saratoga.Columns>
                <AdminModule_ResendInvitation_Dialog
                    invitation={invitation}
                    personName={person.name}
                    open={dialogOpen === "resend"}
                    onOpenChange={(open) => setDialogOpen(open ? "resend" : false)}
                />
                <AdminModule_RevokeInvitation_Dialog
                    invitation={invitation}
                    personName={person.name}
                    open={dialogOpen === "revoke"}
                    onOpenChange={(open) => setDialogOpen(open ? "revoke" : false)}
                />
                <AdminModule_UpdateRoles_Dialog
                    personName={person.name}
                    defaultRoles={invitation.roles}
                    title="Update invitation roles"
                    mutationFn={async (roles) =>
                        trpcClient.accessControl.updateInvitationRoles.mutate({
                            organizationId: organization.id,
                            invitationId: invitation.id,
                            roles,
                        })
                    }
                    currentUser={currentUser}
                    open={dialogOpen === "update-invitation"}
                    onOpenChange={(open) => setDialogOpen(open ? "update-invitation" : false)}
                />
            </Saratoga.Root>
        ))
        .with({ accessStatus: "Joined" }, ({ user }) => (
            <Saratoga.Root>
                <Saratoga.Header>
                    <Saratoga.Title>{person.name}</Saratoga.Title>
                    <Saratoga.Actions>
                        <Protect orgId={organization.id} permissions={{ member: ["delete"] }}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <DropdownMenuTriggerIcon />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuGroup>
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuItem
                                            onSelect={() => setDialogOpen("delete")}
                                            disabled={user.userId === session?.user.id}
                                            className="text-destructive"
                                        >
                                            <ObjectIcons.Delete />
                                            Remove
                                        </DropdownMenuItem>
                                    </DropdownMenuGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </Protect>
                    </Saratoga.Actions>
                </Saratoga.Header>
                <Saratoga.Columns>
                    <Saratoga.Column slot="main">
                        <Card>
                            <CardHeader>
                                <CardTitle>Access</CardTitle>
                                <CardAction>
                                    <Protect
                                        orgId={organization.id}
                                        permissions={{ member: ["update"] }}
                                    >
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setDialogOpen("update")}
                                                >
                                                    <ObjectIcons.Edit />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Edit roles</TooltipContent>
                                        </Tooltip>
                                    </Protect>
                                </CardAction>
                            </CardHeader>
                            <CardContent>
                                <DL>
                                    <DLTerm>Status</DLTerm>
                                    <DLDetails>Joined</DLDetails>
                                    <DLTerm>User ID</DLTerm>
                                    <DLDetails>{user.userId}</DLDetails>
                                    <DLTerm>Email</DLTerm>
                                    <DLDetails>{user.email}</DLDetails>
                                    <DLTerm>Role(s)</DLTerm>
                                    <DLDetails>
                                        {user.roles
                                            .map((r) => OrganizationRole.displayNames[r])
                                            .join(", ")}
                                    </DLDetails>
                                </DL>
                            </CardContent>
                        </Card>
                    </Saratoga.Column>
                    <Saratoga.Column slot="secondary">
                        <Card>
                            <CardContent>
                                <DL>
                                    <DLTerm>Joined</DLTerm>
                                    <DLDetails>
                                        <div>{formatDateTime(user.createdAt)}</div>
                                        <div className="text-muted-foreground">
                                            {formatRelativeDateTime(user.createdAt)}
                                        </div>
                                    </DLDetails>
                                    <DLTerm>Updated</DLTerm>
                                    <DLDetails>
                                        <div>{formatDateTime(user.updatedAt)}</div>
                                        <div className="text-muted-foreground">
                                            {formatRelativeDateTime(user.updatedAt)}
                                        </div>
                                    </DLDetails>
                                </DL>
                            </CardContent>
                        </Card>
                    </Saratoga.Column>
                </Saratoga.Columns>
                <AdminModule_UpdateRoles_Dialog
                    personName={user.name}
                    defaultRoles={user.roles}
                    title="Update user roles"
                    mutationFn={async (roles) => {
                        const { error } = await authClient.organization.updateMemberRole({
                            organizationId: organization.id,
                            memberId: user.organizationUserId,
                            role: roles,
                        });
                        if (error) throw error;
                    }}
                    currentUser={currentUser}
                    open={dialogOpen === "update"}
                    onOpenChange={(open) => setDialogOpen(open ? "update" : false)}
                />
                <AdminModule_DeleteUser_Dialog
                    user={user}
                    open={dialogOpen === "delete"}
                    onOpenChange={(open) => setDialogOpen(open ? "delete" : false)}
                />
            </Saratoga.Root>
        ))
        .exhaustive();
}
