/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { KeyRoundIcon, RefreshCwIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useRef } from "react";

import { ObjectIcons } from "@/components/icons";
import {
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EntityActionMenu, type MenuActionProps } from "@/components/ui/menu-action";
import type { RouterOutput } from "@/trpc/routers/_app";

import { UserSettings_EditD4HAccessToken_Dialog } from "./edit-d4h-access-token-dialog";
import { UserSettings_RemoveD4HAccessToken_Dialog } from "./remove-d4h-access-token";
import { UserSettings_ReplaceD4HAccessToken_Dialog } from "./replace-d4h-access-token-dialog";

type PersonalAccessToken = RouterOutput["d4hAccessTokens"]["listPersonalAccessTokens"][number];

export const PersonalD4HAccessTokenAction = parseAsStringLiteral([
    "edit",
    "replace",
    "remove",
] as const);

export function UserSettings_D4HAccessToken_Menu({
    token,
    onRefresh,
}: {
    token: PersonalAccessToken;
    onRefresh: () => void;
}) {
    const [action, setAction] = useQueryState("action", PersonalD4HAccessTokenAction);
    // The menu item that opens a dialog unmounts with the menu, so focus returns to the trigger.
    const triggerRef = useRef<HTMLButtonElement>(null);

    // The menu opens each dialog, so the edit and replace dialogs only ever ask to close.
    function handleOpenChange(open: boolean) {
        if (!open) void setAction(null, { history: "replace" });
    }

    const actions: MenuActionProps[] = [
        {
            verb: "update",
            label: "Edit",
            icon: <ObjectIcons.Edit />,
            onSelect: () => setAction("edit", { history: "push" }),
        },
        {
            verb: "replace",
            label: "Replace token value",
            icon: <KeyRoundIcon />,
            onSelect: () => setAction("replace", { history: "push" }),
        },
        {
            verb: "delete",
            label: "Remove",
            icon: <ObjectIcons.Delete />,
            onSelect: () => setAction("remove", { history: "push" }),
            destructive: true,
        },
    ];

    return (
        <>
            <EntityActionMenu
                actions={actions}
                category="D4H Access Token"
                triggerRef={triggerRef}
                before={
                    <>
                        <DropdownMenuGroup>
                            <DropdownMenuItem onClick={onRefresh}>
                                <RefreshCwIcon /> Refresh from D4H
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                    </>
                }
            />

            <UserSettings_EditD4HAccessToken_Dialog
                token={token}
                open={action === "edit"}
                onOpenChange={handleOpenChange}
                returnFocusRef={triggerRef}
            />
            <UserSettings_ReplaceD4HAccessToken_Dialog
                tokenId={token.id}
                organizationId={token.organization.id}
                open={action === "replace"}
                onOpenChange={handleOpenChange}
                returnFocusRef={triggerRef}
            />
            <UserSettings_RemoveD4HAccessToken_Dialog
                token={token}
                open={action === "remove"}
                returnFocusRef={triggerRef}
                onOpenChange={(open) =>
                    setAction(open ? "remove" : null, { history: open ? "push" : "replace" })
                }
            />
        </>
    );
}
