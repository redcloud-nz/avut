/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { parseAsStringLiteral, useQueryState } from "nuqs";

import { ObjectIcons } from "@/components/icons";
import { EntityActionMenu, type MenuActionProps } from "@/components/ui/menu-action";
import { useHasPermission } from "@/hooks/use-has-permission";

/**
 * The item page's Actions menu: Edit (`?action=update`, Alt+E).
 */
export function D4HModule_EquipmentItem_Menu({
    canUpdateInD4H,
}: {
    /** The viewer's D4H account has Equipment UPDATE on the item's team. */
    canUpdateInD4H: boolean;
}) {
    const [, setAction] = useQueryState("action", parseAsStringLiteral(["update"] as const));

    const canUpdate = useHasPermission({ d4hEquipment: ["update"] });

    const actions: MenuActionProps[] = [
        {
            verb: "update",
            label: "Edit",
            icon: <ObjectIcons.Edit />,
            onSelect: () => setAction("update", { history: "push" }),
            disabled: !canUpdate || !canUpdateInD4H,
        },
    ];

    return <EntityActionMenu actions={actions} category="Equipment" />;
}
