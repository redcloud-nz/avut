/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { LogOutIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { EntityActionMenu, type MenuActionProps } from "@/components/ui/menu-action";
import type { RouterOutput } from "@/trpc/routers/_app";

import { UserSettings_LeaveOrganization_Dialog } from "./leave-organization";

type Membership = RouterOutput["user"]["listMemberships"][number];

export function UserSettings_Organization_Menu({ membership }: { membership: Membership }) {
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

    return (
        <>
            <EntityActionMenu actions={actions} category="Organisation" />

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
