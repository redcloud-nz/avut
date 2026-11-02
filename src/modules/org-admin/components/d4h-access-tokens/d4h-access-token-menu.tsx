/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { KeyRoundIcon, RefreshCwIcon } from "lucide-react";
import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { ObjectIcons } from "@/components/icons";
import {
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { EntityActionMenu, type MenuActionProps } from "@/components/ui/menu-action";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import type { Permissions } from "@/lib/permissions";
import { route } from "@/lib/routes";
import type { RouterOutput } from "@/trpc/routers/_app";

import { AdminModule_DeleteD4HAccessToken_Dialog } from "./delete-d4h-access-token-dialog";
import { AdminModule_EditD4HAccessToken_Dialog } from "./edit-d4h-access-token-dialog";
import { AdminModule_ReplaceD4HAccessToken_Dialog } from "./replace-d4h-access-token-dialog";

type OrganizationAccessToken = RouterOutput["d4hAccessTokens"]["getOrganizationAccessToken"];

// Matches `updateOrganizationAccessToken`, `replaceOrganizationAccessToken` and
// `deleteOrganizationAccessToken`, which all require `organization: ["update"]`.
const TOKEN_PERMISSIONS: Permissions = { organization: ["update"] };

export const D4HAccessTokenAction = parseAsStringLiteral(["edit", "replace", "delete"] as const);

export function AdminModule_D4HAccessToken_Menu({
    token,
    onRefresh,
}: {
    token: OrganizationAccessToken;
    onRefresh: () => void;
}) {
    const organization = useOrganization();
    const canManage = useHasPermission(TOKEN_PERMISSIONS);
    const [action, setAction] = useQueryState("action", D4HAccessTokenAction);

    function openAction(next: "edit" | "replace" | "delete") {
        void setAction(next, { history: "push" });
    }

    // The menu opens each dialog, so a dialog only ever asks to close.
    function handleOpenChange(open: boolean) {
        if (!open) void setAction(null, { history: "replace" });
    }

    const actions: MenuActionProps[] = [
        {
            verb: "update",
            label: "Edit",
            icon: <ObjectIcons.Edit />,
            onSelect: () => openAction("edit"),
            disabled: !canManage,
        },
        {
            verb: "import",
            label: "Replace token value",
            icon: <KeyRoundIcon />,
            onSelect: () => openAction("replace"),
            disabled: !canManage,
        },
        {
            verb: "delete",
            label: "Delete",
            icon: <ObjectIcons.Delete />,
            onSelect: () => openAction("delete"),
            disabled: !canManage,
            destructive: true,
        },
    ];

    return (
        <>
            <EntityActionMenu
                actions={actions}
                category="D4H Access Token"
                before={
                    <>
                        <DropdownMenuGroup>
                            <DropdownMenuItem asChild disabled={!canManage}>
                                <Link
                                    href={route(
                                        "/orgs/[slug]/admin/d4h-access-tokens/[token_id]/history",
                                        { slug: organization.slug, token_id: token.id },
                                    )}
                                >
                                    <ObjectIcons.History /> History
                                </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled={!canManage} onClick={onRefresh}>
                                <RefreshCwIcon /> Refresh from D4H
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                    </>
                }
            />

            <AdminModule_EditD4HAccessToken_Dialog
                token={token}
                open={action === "edit"}
                onOpenChange={handleOpenChange}
            />
            <AdminModule_ReplaceD4HAccessToken_Dialog
                tokenId={token.id}
                open={action === "replace"}
                onOpenChange={handleOpenChange}
            />
            <AdminModule_DeleteD4HAccessToken_Dialog
                token={token}
                open={action === "delete"}
                onOpenChange={handleOpenChange}
            />
        </>
    );
}
