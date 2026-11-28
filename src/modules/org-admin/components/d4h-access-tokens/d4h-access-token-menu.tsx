/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { KeyRoundIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useRef } from "react";

import { ObjectIcons } from "@/components/icons";
import { type MenuActionProps } from "@/components/ui/menu-action";
import { RecordCardMenu } from "@/components/ui/record-card-actions";
import { useHasPermission } from "@/hooks/use-has-permission";
import type { Permissions } from "@/lib/permissions";
import type { RouterOutput } from "@/trpc/routers/_app";

import { AdminModule_DeleteD4HAccessToken_Dialog } from "./delete-d4h-access-token-dialog";
import { AdminModule_EditD4HAccessToken_Dialog } from "./edit-d4h-access-token-dialog";
import { AdminModule_ReplaceD4HAccessToken_Dialog } from "./replace-d4h-access-token-dialog";

type OrganizationAccessToken = RouterOutput["d4hAccessTokens"]["getOrganizationAccessToken"];

/** Matches `updateOrganizationAccessToken`, `replaceOrganizationAccessToken`,
 *  `deleteOrganizationAccessToken` and `refreshToken`, which all require
 *  `organization: ["update"]`. */
export const D4H_ACCESS_TOKEN_PERMISSIONS: Permissions = { organization: ["update"] };

export const D4HAccessTokenAction = parseAsStringLiteral(["edit", "replace", "delete"] as const);

/**
 * The token card's ⋮ (the page's primary record card): Replace token value and Delete. Edit is
 * the card's pencil, Refresh from D4H its icon, History its "Updated" footer.
 *
 * Mounts every dialog on the page, the pencil's Edit included.
 */
export function AdminModule_D4HAccessToken_Menu({ token }: { token: OrganizationAccessToken }) {
    const canManage = useHasPermission(D4H_ACCESS_TOKEN_PERMISSIONS);
    const [action, setAction] = useQueryState("action", D4HAccessTokenAction);
    // The menu item that opens a dialog unmounts with the menu, so focus returns to the trigger.
    const triggerRef = useRef<HTMLButtonElement>(null);

    // The pencil and the menu open each dialog, so a dialog only ever asks to close.
    function handleOpenChange(open: boolean) {
        if (!open) void setAction(null, { history: "replace" });
    }

    const actions: MenuActionProps[] = [];
    if (canManage) {
        actions.push(
            {
                verb: "replace",
                label: "Replace token value",
                icon: <KeyRoundIcon />,
                onSelect: () => void setAction("replace", { history: "push" }),
            },
            {
                verb: "delete",
                label: "Delete",
                icon: <ObjectIcons.Delete />,
                onSelect: () => void setAction("delete", { history: "push" }),
                destructive: true,
            },
        );
    }

    return (
        <>
            <RecordCardMenu
                actions={actions}
                category="D4H Access Token"
                primary
                triggerRef={triggerRef}
            />

            <AdminModule_EditD4HAccessToken_Dialog
                token={token}
                open={action === "edit"}
                onOpenChange={handleOpenChange}
                returnFocusRef={triggerRef}
            />
            <AdminModule_ReplaceD4HAccessToken_Dialog
                tokenId={token.id}
                open={action === "replace"}
                onOpenChange={handleOpenChange}
                returnFocusRef={triggerRef}
            />
            <AdminModule_DeleteD4HAccessToken_Dialog
                token={token}
                open={action === "delete"}
                onOpenChange={handleOpenChange}
                returnFocusRef={triggerRef}
            />
        </>
    );
}
