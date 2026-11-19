/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { ObjectIcons } from "@/components/icons";
import { Teams_D4HMenuGroup } from "@/components/teams/d4h-link-card";
import { EntityActionMenu, type MenuActionProps } from "@/components/ui/menu-action";
import { useHasPermission } from "@/hooks/use-has-permission";
import { TeamData } from "@/lib/schemas/team";

const ACTIONS = ["update", "d4h-link", "d4h-sync", "d4h-unlink"] as const;

/**
 * Team admin's action menu: **Edit**, then the D4H group. Lifecycle actions (archive, delete,
 * …) and History stay in org admin. Only sets `?action=`: the Details and D4H cards render the
 * dialogs.
 */
export function TeamAdmin_Team_Menu({ team }: { team: TeamData }) {
    const [, setAction] = useQueryState("action", parseAsStringLiteral(ACTIONS));
    const canUpdate = useHasPermission({ team: ["update"] });

    const actions: MenuActionProps[] = [
        {
            verb: "update",
            label: "Edit",
            icon: <ObjectIcons.Edit />,
            onSelect: () => void setAction("update", { history: "push" }),
            disabled: !canUpdate,
        },
    ];

    return (
        <EntityActionMenu
            actions={actions}
            category="Team"
            after={<Teams_D4HMenuGroup team={team} setAction={setAction} />}
        />
    );
}
