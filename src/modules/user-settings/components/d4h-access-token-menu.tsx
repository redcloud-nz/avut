/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { ObjectIcons } from "@/components/icons";
import { EntityActionMenu, type MenuActionProps } from "@/components/ui/menu-action";
import type { RouterOutput } from "@/trpc/routers/_app";

import { UserSettings_RemoveD4HAccessToken_Dialog } from "./remove-d4h-access-token";

type PersonalAccessToken = RouterOutput["d4hAccessTokens"]["listPersonalAccessTokens"][number];

export function UserSettings_D4HAccessToken_Menu({ token }: { token: PersonalAccessToken }) {
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["remove"] as const));

    const actions: MenuActionProps[] = [
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
            <EntityActionMenu actions={actions} category="D4H Access Token" />

            <UserSettings_RemoveD4HAccessToken_Dialog
                token={token}
                open={action === "remove"}
                onOpenChange={(open) =>
                    setAction(open ? "remove" : null, { history: open ? "push" : "replace" })
                }
            />
        </>
    );
}
