/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { SendIcon } from "lucide-react";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

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
import { trpc } from "@/trpc/client";

import { AdminModule_DeleteUser_Dialog } from "./delete-user";
import { AdminModule_UpdateUserRoles_Dialog } from "./update-roles";

export function AdminModule_AccessControl_PersonAccessControl_Card({
    personId,
}: {
    personId: PersonId;
}) {
    const organization = useOrganization();
    const queryClient = useQueryClient();
    const router = useRouter();

    const { data: session } = authClient.useSession();

    const { data: personnel } = useSuspenseQuery(
        trpc.accessControl.listPersonnelWithAccess.queryOptions({
            organizationId: organization.id,
        }),
    );

    const person = personnel.find((p) => p.id === personId);
    if (!person) throw new Error("Person not found");

    const currentUser = personnel.find((p) => p.user?.userId === session?.user.id)?.user ?? null;

    const [updateRolesOpen, setUpdateRolesOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const resendMutation = useMutation({
        mutationFn: async () => {
            if (!person.invitation) throw new Error("No invitation to resend");
            await authClient.organization.inviteMember({
                organizationId: organization.id,
                email: person.invitation.email,
                role: person.invitation.roles,
                resend: true,
            });
        },
        onError(error) {
            console.error("Error resending invitation:", error);
            toast.error("Failed to resend invitation.");
        },
        onSuccess() {
            toast.success("Invitation resent.");
        },
    });

    const revokeMutation = useMutation({
        mutationFn: async () => {
            if (!person.invitation) throw new Error("No invitation to revoke");
            await authClient.organization.cancelInvitation({
                invitationId: person.invitation.id,
            });
        },
        onError(error) {
            console.error("Error revoking invitation:", error);
            toast.error("Failed to revoke invitation.");
        },
        async onSuccess() {
            toast.success("Invitation revoked.");
            await queryClient.invalidateQueries(
                trpc.accessControl.listPersonnelWithAccess.queryFilter({
                    organizationId: organization.id,
                }),
            );
        },
    });

    if (person.accessStatus === "None") {
        return (
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
        );
    }

    if (person.accessStatus === "Invited" && person.invitation) {
        const { invitation } = person;
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Access</CardTitle>
                    <CardAction>
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
                                        onSelect={() => resendMutation.mutate()}
                                        disabled={resendMutation.isPending}
                                    >
                                        <SendIcon />
                                        Resend
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onSelect={() => revokeMutation.mutate()}
                                        disabled={revokeMutation.isPending}
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
                            <FieldValue value={invitation.createdAt} format="dateWithDistance" />
                        </Field>
                        <Field orientation="responsive">
                            <FieldLabel>Expires</FieldLabel>
                            <FieldValue value={invitation.expiresAt} format="dateWithDistance" />
                        </Field>
                    </FieldGroup>
                </CardContent>
            </Card>
        );
    }

    if (person.accessStatus === "Joined" && person.user) {
        const { user } = person;
        return (
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
                                            onClick={() => setUpdateRolesOpen(true)}
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
                                                onSelect={() => setDeleteDialogOpen(true)}
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
                                <FieldValue value={user.createdAt} format="dateWithDistance" />
                            </Field>
                            <Field orientation="responsive">
                                <FieldLabel>Updated</FieldLabel>
                                <FieldValue value={user.updatedAt} format="dateWithDistance" />
                            </Field>
                        </FieldGroup>
                    </CardContent>
                </Card>
                {currentUser && (
                    <AdminModule_UpdateUserRoles_Dialog
                        open={updateRolesOpen}
                        onOpenChange={setUpdateRolesOpen}
                        user={user}
                        currentUser={currentUser}
                    />
                )}
                <AdminModule_DeleteUser_Dialog
                    user={user}
                    open={deleteDialogOpen}
                    onOpenChange={setDeleteDialogOpen}
                    onDeleteSuccess={() =>
                        router.push(route("/main/[slug]/admin/access", { slug: organization.slug }))
                    }
                />
            </>
        );
    }

    return null;
}
