/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import {
    BanIcon,
    CircleCheckIcon,
    ShieldIcon,
    ShieldOffIcon,
    VenetianMaskIcon,
} from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { useUser } from "@/client/auth-queries";
import { ObjectIcons } from "@/components/icons";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { EntityActionMenu, type MenuActionProps } from "@/components/ui/menu-action";
import { UserId } from "@/lib/schemas/user";
import { SystemAdmin_BanUser_Dialog } from "@/modules/system-admin/components/users/ban-user-dialog";
import { SystemAdmin_DeleteUser_Dialog } from "@/modules/system-admin/components/users/delete-user-dialog";
import { SystemAdmin_ImpersonateUser_Dialog } from "@/modules/system-admin/components/users/impersonate-user-dialog";
import { SystemAdmin_SetUserRole_Dialog } from "@/modules/system-admin/components/users/set-user-role-dialog";
import { type RouterOutput } from "@/trpc/client";

type SystemAdminUser = RouterOutput["users"]["getUser"];

/**
 * Actions dropdown for a system-admin user detail page — mirrors how org member actions
 * live only on the org detail page. The users list links each name to this page; it has no
 * per-row action menu of its own.
 *
 * Items: "Impersonate" (`?action=impersonate`), "Promote to admin" / "Demote to user"
 * (`?action=promote` / `?action=demote`, one shown depending on the user's system role),
 * "Ban user" / "Unban user" (`?action=ban` / `?action=unban`, one shown depending on
 * `user.banned`), and "Delete user" (`?action=delete`, hard delete, type-to-confirm). All are
 * hidden when the row user is the signed-in operator — the tRPC procedures refuse a self-target
 * anyway, this just keeps them off the menu.
 *
 * `Alt+Backspace` opens Delete, and `Mod+.` opens the menu (`EntityActionMenu`).
 */
export function SystemAdmin_UserActions_Menu({ user }: { user: SystemAdminUser }) {
    const { data: currentUser } = useUser();
    const isSelf = currentUser?.id === user.id;

    const [action, setAction] = useQueryState(
        "action",
        parseAsStringLiteral([
            "ban",
            "unban",
            "delete",
            "impersonate",
            "promote",
            "demote",
        ] as const),
    );

    const isAdmin = user.role === "admin";

    // `getUser` returns `id` as a plain string; brand it once for the tRPC-input dialogs.
    const target = { ...user, id: UserId.schema.parse(user.id) };

    function open(next: "ban" | "unban" | "delete" | "impersonate" | "promote" | "demote") {
        void setAction(next, { history: "push" });
    }
    function close() {
        void setAction(null, { history: "replace" });
    }

    const actions: MenuActionProps[] = isSelf
        ? []
        : [
              {
                  verb: "impersonate",
                  label: "Impersonate",
                  icon: <VenetianMaskIcon />,
                  onSelect: () => open("impersonate"),
              },
              isAdmin
                  ? {
                        verb: "demote",
                        label: "Demote to user",
                        icon: <ShieldOffIcon />,
                        onSelect: () => open("demote"),
                    }
                  : {
                        verb: "promote",
                        label: "Promote to admin",
                        icon: <ShieldIcon />,
                        onSelect: () => open("promote"),
                    },
              user.banned
                  ? {
                        verb: "unban",
                        label: "Unban user",
                        icon: <CircleCheckIcon />,
                        onSelect: () => open("unban"),
                    }
                  : {
                        verb: "ban",
                        label: "Ban user",
                        icon: <BanIcon />,
                        onSelect: () => open("ban"),
                    },
              {
                  verb: "delete",
                  label: "Delete user",
                  icon: <ObjectIcons.Delete />,
                  onSelect: () => open("delete"),
                  destructive: true,
              },
          ];

    return (
        <>
            <EntityActionMenu
                actions={actions}
                category="User"
                after={isSelf && <DropdownMenuItem disabled>No actions available</DropdownMenuItem>}
            />

            {!isSelf && (
                <>
                    <SystemAdmin_ImpersonateUser_Dialog
                        user={user}
                        open={action === "impersonate"}
                        onOpenChange={(next) => (next ? undefined : close())}
                    />
                    <SystemAdmin_BanUser_Dialog
                        user={target}
                        action={action === "unban" ? "unban" : "ban"}
                        open={action === "ban" || action === "unban"}
                        onOpenChange={(next) => (next ? undefined : close())}
                    />
                    <SystemAdmin_DeleteUser_Dialog
                        user={user}
                        open={action === "delete"}
                        onOpenChange={(next) => (next ? undefined : close())}
                    />
                    <SystemAdmin_SetUserRole_Dialog
                        user={target}
                        action={action === "demote" ? "demote" : "promote"}
                        open={action === "promote" || action === "demote"}
                        onOpenChange={(next) => (next ? undefined : close())}
                    />
                </>
            )}
        </>
    );
}
