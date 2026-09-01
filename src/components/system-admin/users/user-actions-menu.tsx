/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { ShieldIcon, ShieldOffIcon, VenetianMaskIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { useUser } from "@/client/auth-queries";
import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { SystemAdmin_DeleteUser_Dialog } from "@/components/system-admin/users/delete-user-dialog";
import { SystemAdmin_ImpersonateUser_Dialog } from "@/components/system-admin/users/impersonate-user-dialog";
import { SystemAdmin_SetUserRole_Dialog } from "@/components/system-admin/users/set-user-role-dialog";
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
 * Actions dropdown for a system-admin user detail page — mirrors how org member actions
 * live only on the org detail page. The users list links each name to this page; it has no
 * per-row action menu of its own.
 *
 * Items: "Impersonate" (`?action=impersonate`), "Promote to admin" / "Demote to user"
 * (`?action=promote` / `?action=demote`, one shown depending on the user's global role), and
 * "Delete user" (`?action=delete`, hard delete, type-to-confirm). All are hidden when the row
 * user is the signed-in operator — the tRPC procedures refuse a self-target anyway, this just
 * keeps them off the menu.
 *
 * Later phases (ban/unban, revoke sessions) add more items here.
 */
export function SystemAdmin_UserActions_Menu({ user }: { user: SystemAdminUser }) {
    const { data: currentUser } = useUser();
    const isSelf = currentUser?.id === user.id;

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["delete", "impersonate", "promote", "demote"] as const),
    );

    const isAdmin = user.role === "admin";

    function open(next: "delete" | "impersonate" | "promote" | "demote") {
        void setAction(next, { history: "push" });
    }
    function close() {
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
                        <>
                            <DropdownMenuItem onSelect={() => open("impersonate")}>
                                <VenetianMaskIcon /> Impersonate
                            </DropdownMenuItem>
                            {isAdmin ? (
                                <DropdownMenuItem onSelect={() => open("demote")}>
                                    <ShieldOffIcon /> Demote to user
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem onSelect={() => open("promote")}>
                                    <ShieldIcon /> Promote to admin
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem variant="destructive" onSelect={() => open("delete")}>
                                <ObjectIcons.Delete /> Delete user
                            </DropdownMenuItem>
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>

            {!isSelf && (
                <>
                    <SystemAdmin_ImpersonateUser_Dialog
                        user={user}
                        open={action === "impersonate"}
                        onOpenChange={(open) => (open ? undefined : close())}
                    />
                    <SystemAdmin_DeleteUser_Dialog
                        user={user}
                        open={action === "delete"}
                        onOpenChange={(open) => (open ? undefined : close())}
                    />
                    <SystemAdmin_SetUserRole_Dialog
                        user={user}
                        action={isAdmin ? "demote" : "promote"}
                        open={action === "promote" || action === "demote"}
                        onOpenChange={(open) => (open ? undefined : close())}
                    />
                </>
            )}
        </>
    );
}
