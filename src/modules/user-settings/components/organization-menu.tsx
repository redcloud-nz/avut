/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { LogOutIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { type MenuActionProps } from "@/components/ui/menu-action";
import { RecordCardMenu } from "@/components/ui/record-card-actions";
import type { RouterOutput } from "@/trpc/routers/_app";

import { UserSettings_LeaveOrganization_Dialog } from "./leave-organization";

type Membership = RouterOutput["user"]["listMemberships"][number];

/**
 * The Organisation card's ⋮ (the page's primary record card): Leave. Mounts the Leave dialog.
 */
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
            <RecordCardMenu actions={actions} category="Organisation" primary />

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
