/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { LogOutIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { DropdownMenuTriggerIcon } from "@/components/icons";
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

import { UserSettings_LeaveOrganization_Dialog } from "./leave-organization-dialog";

type Membership = RouterOutput["users"]["listMemberships"][number];

export function UserSettings_OrganizationMenu({ membership }: { membership: Membership }) {
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(["leave"] as const));

    const actions: MenuActionProps[] = [
        {
            verb: "delete",
            label: "Leave",
            icon: <LogOutIcon />,
            onSelect: () => setAction("leave", { history: "push" }),
            destructive: true,
        },
    ];

    useMenuActionHotkeys(actions, "Organisation");

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

            <UserSettings_LeaveOrganization_Dialog
                membership={membership}
                open={action === "leave"}
                onOpenChange={(open) =>
                    setAction(open ? "leave" : null, { history: open ? "push" : "replace" })
                }
            />
        </>
    );
}
