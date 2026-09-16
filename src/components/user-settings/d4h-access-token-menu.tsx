/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { DropdownMenuTriggerIcon, ObjectIcons } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    MenuAction,
    useMenuActionHotkeys,
    type MenuActionProps,
} from "@/components/ui/menu-action";

import type { RouterOutput } from "@/trpc/routers/_app";

import { UserSettings_RemoveD4HAccessToken_Dialog } from "./remove-d4h-access-token-dialog";

type PersonalAccessToken = RouterOutput["d4hAccessTokens"]["listPersonalAccessTokens"][number];

export function UserSettings_D4HAccessTokenMenu({ token }: { token: PersonalAccessToken }) {
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

    useMenuActionHotkeys(actions, "D4H Access Token");

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <DropdownMenuTriggerIcon />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-50" align="end">
                    <DropdownMenuGroup>
                        {actions.map((a) => (
                            <MenuAction key={a.verb} {...a} />
                        ))}
                    </DropdownMenuGroup>
                </DropdownMenuContent>
            </DropdownMenu>

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
