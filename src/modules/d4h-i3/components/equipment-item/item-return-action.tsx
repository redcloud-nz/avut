/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { PackageCheckIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { useSuspenseQueries } from "@tanstack/react-query";

import {
    MenuAction,
    useEntityActionMenuTrigger,
    useMenuActionHotkeys,
    type MenuActionProps,
} from "@/components/ui/menu-action";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { hasD4HTeamPermission } from "@/lib/d4h-permissions";
import { trpc } from "@/trpc/client";

import { D4HI3Module_ReturnEquipmentItem_Dialog } from "./return-equipment-item";

/**
 * I3's Return action for the D4H item page's Actions menu, which its `page.tsx` passes in as two
 * slots: {@link D4HI3Module_ItemReturn_MenuAction} goes in the menu and
 * {@link D4HI3Module_ItemReturn_Dialog} beside it.
 *
 * Return is left out when the item isn't issued to a member, and disabled when it's already
 * returned, the viewer lacks the I3 role, or their D4H account lacks Equipment UPDATE.
 */
function useItemReturn(teamId: number, itemId: number) {
    const organization = useOrganization();

    const [
        {
            data: { item, holder },
        },
        { data: teams },
        { data: returnedItemIds },
    ] = useSuspenseQueries({
        queries: [
            trpc.d4hApi.getEquipmentItem.queryOptions({
                organizationId: organization.id,
                teamId,
                itemId,
            }),
            trpc.d4hApi.listAccessibleTeams.queryOptions({ organizationId: organization.id }),
            trpc.d4hTasks.listReturnedItemIds.queryOptions({
                organizationId: organization.id,
                teamId,
            }),
        ],
    });

    const [, setAction] = useQueryState("action", parseAsStringLiteral(["return"] as const));
    const hasPermission = useHasPermission({ i3Item: ["return"] });

    const team = teams.find((t) => t.id === teamId);
    const canUpdateInD4H = team
        ? hasD4HTeamPermission(team.permissions, "Equipment", "UPDATE")
        : false;

    const action: MenuActionProps = {
        verb: "return",
        label: "Return",
        icon: <PackageCheckIcon />,
        onSelect: () => setAction("return", { history: "push" }),
        disabled: !holder || !hasPermission || !canUpdateInD4H || returnedItemIds.includes(item.id),
    };

    return { item, holder, action };
}

/** The Return item in the D4H item page's Actions menu. */
export function D4HI3Module_ItemReturn_MenuAction({
    teamId,
    itemId,
}: {
    teamId: number;
    itemId: number;
}) {
    const { holder, action } = useItemReturn(teamId, itemId);

    if (!holder) return null;

    return <MenuAction {...action} />;
}

/**
 * The `?action=return` dialog and the Return hotkey, mounted beside the Actions menu so both
 * work while the menu is closed. Focus goes back to the menu's button when the dialog closes.
 */
export function D4HI3Module_ItemReturn_Dialog({
    teamId,
    itemId,
}: {
    teamId: number;
    itemId: number;
}) {
    const { item, holder, action } = useItemReturn(teamId, itemId);
    const triggerRef = useEntityActionMenuTrigger();

    useMenuActionHotkeys([action], "Equipment");

    if (!holder) return null;

    return (
        <D4HI3Module_ReturnEquipmentItem_Dialog
            teamId={teamId}
            itemId={item.id}
            itemLabel={`#${item.ref} ${item.kind.title}`}
            holder={holder}
            canReturn={!action.disabled}
            returnFocusRef={triggerRef}
        />
    );
}
