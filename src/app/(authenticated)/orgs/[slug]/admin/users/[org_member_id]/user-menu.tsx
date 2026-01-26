/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DeleteObjectIcon, DropdownMenuTriggerIcon } from "@/components/icons";
import { S2_Button } from "@/components/ui/s2-button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/s2-dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup } from "@/components/ui/field";
import { ObjectName } from "@/components/ui/typography";

import { OrganizationData } from "@/lib/schemas/organization";
import { OrganizationMemberData } from "@/lib/schemas/organization-member";
import { UserData } from "@/lib/schemas/user";
import * as Paths from "@/paths";
import { trpc } from "@/trpc/client";

interface AdminModule_UserMenuProps {
    currentUserId: string;
    organization: OrganizationData;
    organizationMember: OrganizationMemberData;
    user: UserData;
}

export function AdminModule_UserMenu({
    organization,
    organizationMember,
    user,
    currentUserId,
}: AdminModule_UserMenuProps) {
    const queryClient = useQueryClient();
    const router = useRouter();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const mutation = useMutation(
        trpc.organizations.removeOrganizationMember.mutationOptions({
            onSuccess() {
                setDeleteDialogOpen(false);

                queryClient.invalidateQueries(
                    trpc.organizations.listOrganizationMembers.queryFilter({
                        organizationId: organization.id,
                    }),
                );

                router.push(Paths.org(organization.slug).admin.users.href);
            },
        }),
    );

    return (
        <>
            {/* User dropdown menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <S2_Button variant="outline" size="icon">
                        <DropdownMenuTriggerIcon />
                    </S2_Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                            onSelect={() => setDeleteDialogOpen(true)}
                            disabled={
                                organizationMember.userId === currentUserId
                            }
                        >
                            <DeleteObjectIcon />
                            Delete User
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Delete confirmation dialog. */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete User</DialogTitle>
                        <DialogDescription>
                            Confirm removal of{" "}
                            <ObjectName>{user.name}</ObjectName> from
                            organization.
                        </DialogDescription>
                    </DialogHeader>
                    <FieldGroup>
                        <Field orientation="horizontal">
                            <S2_Button
                                type="submit"
                                variant="destructive"
                                disabled={mutation.isPending}
                                onClick={() =>
                                    mutation.mutate({
                                        organizationId: organization.id,
                                        organizationMemberId:
                                            organizationMember.id,
                                    })
                                }
                            >
                                Delete
                            </S2_Button>
                        </Field>
                    </FieldGroup>
                </DialogContent>
            </Dialog>
        </>
    );
}
