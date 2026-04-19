/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useState } from "react";

import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Protect } from "@/components/protect";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";

import { authClient } from "@/client/auth-client";
import { useOrganization } from "@/hooks/use-organization";
import { OrganizationUser } from "@/lib/schemas/organization-user";

import { AdminModule_DeleteUser_Dialog } from "./delete-user";

interface AdminModule_UserMenuProps {
    user: OrganizationUser;
}

export function AdminModule_UserMenu({ user }: AdminModule_UserMenuProps) {
    const organization = useOrganization();

    const { data: session } = authClient.useSession();

    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const isSelf = user.userId === session?.user.id;

    return (
        <>
            {/* User dropdown menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuGroup>
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <Protect
                            orgId={organization.id}
                            permissions={{ member: ["delete"] }}
                            fallback={
                                <Empty size="sm">
                                    <EmptyHeader>
                                        <EmptyTitle>No Actions Available</EmptyTitle>
                                        <EmptyDescription>
                                            You do not have permission to perform any actions on
                                            this user.
                                        </EmptyDescription>
                                    </EmptyHeader>
                                </Empty>
                            }
                        >
                            <DropdownMenuItem
                                onClick={() => setDeleteDialogOpen(true)}
                                disabled={user.userId === session?.user.id}
                            >
                                <ObjectIcons.Delete />
                                Delete
                            </DropdownMenuItem>
                        </Protect>
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Delete confirmation dialog. */}
            <AdminModule_DeleteUser_Dialog
                user={user}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
        </>
    );
}
