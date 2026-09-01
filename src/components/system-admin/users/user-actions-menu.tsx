/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { VenetianMaskIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { useUser } from "@/client/auth-queries";
import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { SystemAdmin_DeleteUser_Dialog } from "@/components/system-admin/users/delete-user-dialog";
import { SystemAdmin_ImpersonateUser_Dialog } from "@/components/system-admin/users/impersonate-user-dialog";
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
 * Items: "Impersonate" (`?action=impersonate`) and "Delete user" (`?action=delete`, hard
 * delete, type-to-confirm). Both are hidden when the row user is the signed-in operator —
 * the tRPC procedures refuse a self-target anyway, this just keeps them off the menu.
 *
 * Later phases (set role, ban/unban, revoke sessions) add more items here.
 */
export function SystemAdmin_UserActions_Menu({ user }: { user: SystemAdminUser }) {
    const { data: currentUser } = useUser();
    const isSelf = currentUser?.id === user.id;

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["delete", "impersonate"] as const),
    );

    function open(next: "delete" | "impersonate") {
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
                </>
            )}
        </>
    );
}
