/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { useUser } from "@/client/auth-queries";
import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { SystemAdmin_DeleteUser_Dialog } from "@/components/system-admin/users/delete-user-dialog";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { type RouterOutput } from "@/trpc/client";

type SystemAdminUser = RouterOutput["systemAdmin"]["getUser"];

/**
 * Actions dropdown for a system-admin user detail page.
 *
 * Currently: "Delete user" (`?action=delete`, hard delete, type-to-confirm). The item is
 * hidden when the row user is the signed-in operator — `systemAdmin.deleteUser` refuses a
 * self-delete anyway, this just keeps it off the menu.
 *
 * Later phases (impersonate, set role, ban/unban, revoke sessions) add more items here.
 */
export function SystemAdmin_UserActions_Menu({ user }: { user: SystemAdminUser }) {
    const { data: currentUser } = useUser();
    const isSelf = currentUser?.id === user.id;

    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["delete"] as const));

    function openDelete() {
        void setAction("delete", { history: "push" });
    }
    function closeDelete() {
        void setAction(null, { history: "replace" });
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-48" align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    {isSelf ? (
                        <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
                    ) : (
                        <DropdownMenuItem variant="destructive" onSelect={openDelete}>
                            <ObjectIcons.Delete /> Delete user
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {!isSelf && (
                <SystemAdmin_DeleteUser_Dialog
                    user={user}
                    open={action === "delete"}
                    onOpenChange={(open) => (open ? undefined : closeDelete())}
                />
            )}
        </>
    );
}
