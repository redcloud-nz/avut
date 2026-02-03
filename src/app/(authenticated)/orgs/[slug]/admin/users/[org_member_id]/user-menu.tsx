/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuGroupLabel,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FieldValue } from "@/components/ui/field-value";
import { ObjectName, Paragraph } from "@/components/ui/typography";

import { authClient } from "@/lib/auth-client";
import { OrganizationData } from "@/lib/schemas/organization";
import { OrganizationUserData } from "@/lib/schemas/organization-member";
import { UserData } from "@/lib/schemas/user";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

interface AdminModule_UserMenuProps {
    organization: OrganizationData;
    organizationUser: OrganizationUserData;
    user: UserData;
}

export function AdminModule_UserMenu({
    organization,
    organizationUser,
    user,
}: AdminModule_UserMenuProps) {
    const queryClient = useQueryClient();
    const router = useRouter();

    const { data: session } = authClient.useSession();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const deleteMutation = useMutation(
        trpc.organizations.removeOrganizationUser.mutationOptions({
            onSettled() {
                queryClient.invalidateQueries(
                    trpc.organizations.listOrganizationUsers.queryFilter({
                        organizationId: organization.id,
                    }),
                );
            },
        }),
    );

    function handleRemove() {
        toast.promise(
            async () => {
                await deleteMutation.mutateAsync({
                    organizationId: organization.id,
                    organizationUserId: organizationUser.id,
                });
                router.push(Paths.org(organization.slug).admin.users.href);
            },
            {
                loading: "Removing user from organization...",
                success: "User removed.",
                error: (error) => "Failed to remove user: " + error.message,
            },
        );
    }

    const isSelf = organizationUser.userId === session?.user.id;

    return (
        <>
            {/* User dropdown menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuGroup>
                        <DropdownMenuGroupLabel>Actions</DropdownMenuGroupLabel>
                        <DropdownMenuItem
                            onSelect={() => setDeleteDialogOpen(true)}
                            // disabled={
                            //     organizationUser.userId === session?.user.id
                            // }
                        >
                            <ObjectIcons.Delete />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Delete confirmation dialog. */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                {isSelf ? (
                    <DialogContent className="lg:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Cannot Remove User</DialogTitle>
                            <DialogDescription>
                                You cannot remove yourself from the
                                organization.
                            </DialogDescription>
                        </DialogHeader>
                        <Paragraph>
                            <ObjectName>{user.name}</ObjectName> ({user.email})
                            is your own user account. To leave this
                            organization, please contact another organization
                            administrator.
                        </Paragraph>
                        <DialogFooter>
                            <Button onClick={() => setDeleteDialogOpen(false)}>
                                OK
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                ) : (
                    <DialogContent className="lg:max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Remove User</DialogTitle>
                            <DialogDescription>
                                Confirm removal of this user from the
                                organization.
                            </DialogDescription>
                        </DialogHeader>
                        <FieldGroup>
                            <Field orientation="responsive">
                                <FieldLabel>User ID</FieldLabel>
                                <FieldValue
                                    className="min-w-1/2"
                                    value={user.id}
                                />
                            </Field>
                            <Field orientation="responsive">
                                <FieldLabel>Name</FieldLabel>
                                <FieldValue
                                    className="min-w-1/2"
                                    value={user.name}
                                />
                            </Field>
                            <Field orientation="responsive">
                                <FieldLabel>Email</FieldLabel>
                                <FieldValue
                                    className="min-w-1/2"
                                    value={user.email}
                                />
                            </Field>
                        </FieldGroup>
                        <DialogFooter>
                            <Button
                                type="submit"
                                variant="destructive"
                                disabled={deleteMutation.isPending}
                                onClick={handleRemove}
                            >
                                Remove
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>
        </>
    );
}
