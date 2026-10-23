/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { PackageCheckIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import type { RefObject } from "react";

import { ObjectIcons } from "@/components/icons";
import { EntityActionMenu, type MenuActionProps } from "@/components/ui/menu-action";
import { useHasPermission } from "@/hooks/use-has-permission";

/**
 * The item page's Actions menu: Edit (`?action=update`, Alt+E) and Return (`?action=return`).
 *
 * `triggerRef` lands on the menu's own button, which stays mounted after the menu closes, so the
 * dialogs its items open can return focus there.
 */
export function D4HI3Module_EquipmentItem_Menu({
    canUpdateInD4H,
    hasMemberHolder,
    isReturned,
    triggerRef,
}: {
    /** The viewer's D4H account has Equipment UPDATE on the item's team. */
    canUpdateInD4H: boolean;
    /** The item is issued to a D4H member, so there's someone to return it from. */
    hasMemberHolder: boolean;
    /** The item already has an open retire task. */
    isReturned: boolean;
    triggerRef?: RefObject<HTMLButtonElement | null>;
}) {
    const [, setAction] = useQueryState(
        "action",
        parseAsStringLiteral(["update", "return"] as const),
    );

    const canUpdate = useHasPermission({ d4hEquipment: ["update"] });
    const canReturn = useHasPermission({ i3Item: ["return"] });

    const actions: MenuActionProps[] = [
        {
            verb: "update",
            label: "Edit",
            icon: <ObjectIcons.Edit />,
            onSelect: () => setAction("update", { history: "push" }),
            disabled: !canUpdate || !canUpdateInD4H,
        },
        {
            verb: "return",
            label: "Return",
            icon: <PackageCheckIcon />,
            onSelect: () => setAction("return", { history: "push" }),
            disabled: !canReturn || !canUpdateInD4H || isReturned || !hasMemberHolder,
        },
    ];

    return <EntityActionMenu actions={actions} category="Equipment" triggerRef={triggerRef} />;
}
