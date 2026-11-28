/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { PackageCheckIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { type RefObject } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { ActionsCard } from "@/components/ui/record-card-actions";
import { useHasPermission } from "@/hooks/use-has-permission";
import { useOrganization } from "@/hooks/use-organization";
import { hasD4HTeamPermission } from "@/lib/d4h-permissions";
import { trpc } from "@/trpc/client";

import { D4HI3Module_ReturnEquipmentItem_Dialog } from "./return-equipment-item";

/**
 * I3's titled action card for the D4H item page, which its `page.tsx` passes in as the content's
 * `actionCard` slot (the D4H module can't import I3). The item page has no ⋮ to host a dialog, so
 * the card mounts the Return dialog itself.
 *
 * Return shows only when the viewer can take it: the item is issued to a member and not already
 * returned, the viewer has the I3 role, and their D4H account has Equipment UPDATE on the team.
 * With no Return to offer, the card renders nothing.
 */
export function D4HI3Module_ItemReturn_Card({
    teamId,
    itemId,
    returnFocusRef,
}: {
    teamId: number;
    itemId: number;
    /** Where focus goes once the dialog closes: the Return button is gone after it succeeds.
     *  The item page passes the D4H Item card's pencil, which every viewer sees. */
    returnFocusRef?: RefObject<HTMLElement | null>;
}) {
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

    const canReturn =
        !!holder && hasPermission && canUpdateInD4H && !returnedItemIds.includes(item.id);

    return (
        <>
            <ActionsCard
                title="I3"
                description="Return queues a D4H task to retire the item. Nothing changes in D4H until the task is done."
            >
                {canReturn ? (
                    <Button
                        variant="outline"
                        onClick={() => void setAction("return", { history: "push" })}
                    >
                        <PackageCheckIcon /> Return
                    </Button>
                ) : null}
            </ActionsCard>
            {holder && (
                <D4HI3Module_ReturnEquipmentItem_Dialog
                    teamId={teamId}
                    itemId={item.id}
                    itemLabel={`#${item.ref} ${item.kind.title}`}
                    holder={holder}
                    canReturn={canReturn}
                    returnFocusRef={returnFocusRef}
                />
            )}
        </>
    );
}
