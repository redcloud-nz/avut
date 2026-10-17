/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { ObjectIcons } from "@/components/icons";
import { EntityActionMenu, type MenuActionProps } from "@/components/ui/menu-action";
import { OrganizationGroupId } from "@/lib/schemas/organization-group";

import { SystemAdmin_DeleteGroup_Dialog } from "./delete-group-dialog";

const ACTIONS = ["edit", "add-member", "delete"] as const;

/**
 * Header actions menu for a group's detail page. Edit and Add organisation open the dialogs
 * that the Details and Members cards render (they share the `?action=` param); Delete's dialog
 * lives here.
 */
export function SystemAdmin_Group_Menu({
    group,
}: {
    group: { id: OrganizationGroupId; name: string; slug: string };
}) {
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(ACTIONS));

    const actions: MenuActionProps[] = [
        {
            verb: "update",
            label: "Edit",
            icon: <ObjectIcons.Edit />,
            onSelect: () => void setAction("edit", { history: "push" }),
        },
        {
            verb: "create",
            label: "Add organisation",
            icon: <ObjectIcons.Create />,
            onSelect: () => void setAction("add-member", { history: "push" }),
        },
        {
            verb: "delete",
            label: "Delete",
            icon: <ObjectIcons.Delete />,
            onSelect: () => void setAction("delete", { history: "push" }),
            destructive: true,
        },
    ];

    return (
        <>
            <EntityActionMenu actions={actions} category="Groups" width="w-48" />

            <SystemAdmin_DeleteGroup_Dialog
                group={group}
                open={action === "delete"}
                onOpenChange={(open) =>
                    void setAction(open ? "delete" : null, {
                        history: open ? "push" : "replace",
                    })
                }
            />
        </>
    );
}
