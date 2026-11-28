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
import { Button } from "@/components/ui/button";
import { type MenuActionProps } from "@/components/ui/menu-action";
import { ActionsCard, RecordCardMenu } from "@/components/ui/record-card-actions";
import { UserId } from "@/lib/schemas/user";
import { SystemAdmin_BanUser_Dialog } from "@/modules/system-admin/components/users/ban-user-dialog";
import { SystemAdmin_DeleteUser_Dialog } from "@/modules/system-admin/components/users/delete-user-dialog";
import { SystemAdmin_ImpersonateUser_Dialog } from "@/modules/system-admin/components/users/impersonate-user-dialog";
import { SystemAdmin_SetUserRole_Dialog } from "@/modules/system-admin/components/users/set-user-role-dialog";
import { type RouterOutput } from "@/trpc/client";

type SystemAdminUser = RouterOutput["users"]["getUser"];

/** Every `?action=` the system user page's dialogs answer to. */
const userActions = parseAsStringLiteral([
    "ban",
    "unban",
    "delete",
    "impersonate",
    "promote",
    "demote",
] as const);

/**
 * The User card's ⋮ (the page's primary record card) on a system-admin user detail page. The
 * users list links each name to this page; it has no per-row action menu of its own.
 *
 * Items: "Promote to admin" / "Demote to user" (`?action=promote` / `?action=demote`, one shown
 * depending on the user's system role), "Ban user" / "Unban user" (`?action=ban` /
 * `?action=unban`, one shown depending on `user.banned`), and "Delete user" (`?action=delete`,
 * hard delete, type-to-confirm). Impersonate is {@link SystemAdmin_User_ActionsCard}'s button.
 *
 * For the signed-in operator there are no actions, so no ⋮ and no dialogs: the tRPC procedures
 * refuse a self-target anyway, this just keeps them out of reach.
 *
 * `Alt+Backspace` opens Delete, and `Mod+.` opens the menu (`RecordCardMenu primary`).
 *
 * Mounts every dialog on the page, Impersonate included.
 */
export function SystemAdmin_UserActions_Menu({ user }: { user: SystemAdminUser }) {
    const { data: currentUser } = useUser();
    const isSelf = currentUser?.id === user.id;

    const [action, setAction] = useQueryState("action", userActions);

    const isAdmin = user.role === "admin";

    // `getUser` returns `id` as a plain string; brand it once for the tRPC-input dialogs.
    const target = { ...user, id: UserId.schema.parse(user.id) };

    function open(next: "ban" | "unban" | "delete" | "promote" | "demote") {
        void setAction(next, { history: "push" });
    }
    function close() {
        void setAction(null, { history: "replace" });
    }

    const actions: MenuActionProps[] = isSelf
        ? []
        : [
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
            <RecordCardMenu actions={actions} category="User" primary />

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

/**
 * The bare action card at the top of the system user's secondary column: Impersonate. Renders
 * nothing for the signed-in operator, or until it's known who that is (rather than show a button
 * that might vanish). The button only sets `?action=`; the dialog is in
 * {@link SystemAdmin_UserActions_Menu}.
 */
export function SystemAdmin_User_ActionsCard({ user }: { user: SystemAdminUser }) {
    const { data: currentUser } = useUser();
    const canImpersonate = currentUser !== undefined && currentUser.id !== user.id;

    const [, setAction] = useQueryState("action", userActions);

    return (
        <ActionsCard>
            {canImpersonate ? (
                <Button
                    variant="outline"
                    onClick={() => void setAction("impersonate", { history: "push" })}
                >
                    <VenetianMaskIcon /> Impersonate
                </Button>
            ) : null}
        </ActionsCard>
    );
}
