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
import type { RouterOutput } from "@/trpc/routers/_app";

import { UserSettings_RemoveD4HAccessToken_Dialog } from "./remove-d4h-access-token";
import { UserSettings_ReplaceD4HAccessToken_Dialog } from "./replace-d4h-access-token-dialog";

type PersonalAccessToken = RouterOutput["d4hAccessTokens"]["listPersonalAccessTokens"][number];

export const PersonalD4HAccessTokenAction = parseAsStringLiteral([
    "edit",
    "replace",
    "remove",
] as const);

/**
 * The token card's ⋮ (the page's primary record card): Replace token value and Remove. Edit is
 * the card's pencil, Refresh from D4H its icon.
 *
 * Mounts the menu's own dialogs. The pencil is the edit dialog's trigger, so the token page
 * renders that one.
 */
export function UserSettings_D4HAccessToken_Menu({ token }: { token: PersonalAccessToken }) {
    const [action, setAction] = useQueryState("action", PersonalD4HAccessTokenAction);
    // The menu item that opens a dialog unmounts with the menu, so focus returns to the trigger.
    const triggerRef = useRef<HTMLButtonElement>(null);

    // The menu opens the replace dialog, so it only ever asks to close.
    function handleOpenChange(open: boolean) {
        if (!open) void setAction(null, { history: "replace" });
    }

    const actions: MenuActionProps[] = [
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
            <RecordCardMenu
                actions={actions}
                category="D4H Access Token"
                primary
                triggerRef={triggerRef}
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
