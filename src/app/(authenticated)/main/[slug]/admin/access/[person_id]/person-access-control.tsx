/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { SendIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { match } from "ts-pattern";

import { useSuspenseQuery } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel, FieldSeparator } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { useOrganization } from "@/hooks/use-organization";
import { route } from "@/lib/routes";
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
    const router = useRouter();

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
            <Card>
                <CardHeader>
                    <CardTitle>Access</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-sm">
                        No access configured. Use the Invite button on the access control list to
                        invite this person.
                    </p>
                </CardContent>
            </Card>
        ))
        .with({ accessStatus: "Invited" }, ({ invitation }) => (
            <>
                <Card>
                    <CardHeader>
                        <CardTitle>Access</CardTitle>
                        <CardAction className="flex items-center gap-1">
                            <Protect
                                orgId={organization.id}
                                permissions={{ invitation: ["create"] }}
                            >
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setDialogOpen("update-invitation")}
                                        >
                                            <ObjectIcons.Edit />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Edit roles</TooltipContent>
                                </Tooltip>
                            </Protect>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon">
                                        <DropdownMenuTriggerIcon />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuGroup>
                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                        <DropdownMenuItem onSelect={() => setDialogOpen("resend")}>
                                            <SendIcon />
                                            Resend
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onSelect={() => setDialogOpen("revoke")}
                                            className="text-destructive"
                                        >
                                            <ObjectIcons.Delete />
                                            Revoke
                                        </DropdownMenuItem>
                                    </DropdownMenuGroup>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </CardAction>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup>
                            <Field orientation="responsive">
                                <FieldLabel>Status</FieldLabel>
                                <FieldValue value="Invited" />
                            </Field>
                            <Field orientation="responsive">
                                <FieldLabel>Email</FieldLabel>
                                <FieldValue value={invitation.email} />
                            </Field>
                            <Field orientation="responsive">
                                <FieldLabel>Role(s)</FieldLabel>
                                <FieldValue
                                    value={invitation.roles
                                        .map((r) => OrganizationRole.displayNames[r])
                                        .join(", ")}
                                />
                            </Field>
                            <FieldSeparator />
                            <Field orientation="responsive">
                                <FieldLabel>Sent</FieldLabel>
                                <FieldValue
                                    value={invitation.createdAt}
                                    format="dateTimeWithDistance"
                                />
                            </Field>
                            <Field orientation="responsive">
                                <FieldLabel>Expires</FieldLabel>
                                <FieldValue
                                    value={invitation.expiresAt}
                                    format="dateTimeWithDistance"
                                />
                            </Field>
                        </FieldGroup>
                    </CardContent>
                </Card>
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
            </>
        ))
        .with({ accessStatus: "Joined" }, ({ user }) => (
            <>
                <Card>
                    <CardHeader>
                        <CardTitle>Access</CardTitle>
                        <CardAction className="flex items-center gap-1">
                            <Protect orgId={organization.id} permissions={{ member: ["update"] }}>
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
                        </CardAction>
                    </CardHeader>
                    <CardContent>
                        <FieldGroup>
                            <Field orientation="responsive">
                                <FieldLabel>Status</FieldLabel>
                                <FieldValue value="Joined" />
                            </Field>
                            <Field orientation="responsive">
                                <FieldLabel>User ID</FieldLabel>
                                <FieldValue value={user.userId} format="id" />
                            </Field>
                            <Field orientation="responsive">
                                <FieldLabel>Email</FieldLabel>
                                <FieldValue value={user.email} />
                            </Field>
                            <Field orientation="responsive">
                                <FieldLabel>Role(s)</FieldLabel>
                                <FieldValue
                                    value={user.roles
                                        .map((r) => OrganizationRole.displayNames[r])
                                        .join(", ")}
                                />
                            </Field>
                            <FieldSeparator />
                            <Field orientation="responsive">
                                <FieldLabel>Joined</FieldLabel>
                                <FieldValue value={user.createdAt} format="dateTimeWithDistance" />
                            </Field>
                            <Field orientation="responsive">
                                <FieldLabel>Updated</FieldLabel>
                                <FieldValue value={user.updatedAt} format="dateTimeWithDistance" />
                            </Field>
                        </FieldGroup>
                    </CardContent>
                </Card>
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
            </>
        ))
        .exhaustive();
}
