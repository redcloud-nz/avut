/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { ObjectIcons } from "@/components/icons";
import { type MenuActionProps } from "@/components/ui/menu-action";
import { RecordCardMenu } from "@/components/ui/record-card-actions";
import { OrganizationGroupId } from "@/lib/schemas/organization-group";

import { SystemAdmin_DeleteGroup_Dialog } from "./delete-group-dialog";

const ACTIONS = ["delete"] as const;

/**
 * The Group card's ⋮ (the page's primary record card): Delete, whose dialog lives here. Edit is
 * the card's pencil and Add organisation the Members card's Add; each of those dialogs answers
 * to its own `?action=` verb.
 */
export function SystemAdmin_Group_Menu({
    group,
}: {
    group: { id: OrganizationGroupId; name: string; slug: string };
}) {
    const [action, setAction] = useQueryState("action", parseAsStringLiteral(ACTIONS));

    const actions: MenuActionProps[] = [
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
            <RecordCardMenu actions={actions} category="Groups" primary />

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
