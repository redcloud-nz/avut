/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { PackageCheckIcon } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useRef } from "react";

import { useSuspenseQueries } from "@tanstack/react-query";

import { Protect } from "@/components/protect";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useOrganization } from "@/hooks/use-organization";
import { hasD4HTeamPermission } from "@/lib/d4h-permissions";
import { trpc } from "@/trpc/client";

import { D4HI3Module_ReturnEquipmentItem_Dialog } from "./return-equipment-item";

/**
 * I3's Return button for the D4H item page, passed in as a slot by its `page.tsx`, plus the
 * `?action=return` dialog it opens.
 *
 * Renders nothing when the item isn't issued to a member. When it can't be returned (already
 * returned, or the viewer lacks the role or D4H's Equipment UPDATE permission), the button stays
 * rendered and focusable, with `aria-disabled` and a tooltip saying why. That keeps it in place
 * after a successful Return, so the dialog can hand focus back to it.
 */
export function D4HI3Module_ItemReturn_Action({
    teamId,
    itemId,
}: {
    teamId: number;
    itemId: number;
}) {
    const organization = useOrganization();
    const buttonRef = useRef<HTMLButtonElement>(null);

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

    if (!holder) return null;

    const team = teams.find((t) => t.id === teamId);
    const canUpdateInD4H = team
        ? hasD4HTeamPermission(team.permissions, "Equipment", "UPDATE")
        : false;
    const isReturned = returnedItemIds.includes(item.id);

    function disabledReason(hasPermission: boolean): string | null {
        if (isReturned) return "Already returned. Its retire task is waiting in D4H Tasks.";
        if (!hasPermission) return "Returning items needs the I3 Editor or I3 Admin role.";
        if (!canUpdateInD4H) {
            return `Your D4H account doesn't have the Equipment Update permission on ${team?.title ?? "this team"}.`;
        }
        return null;
    }

    return (
        <Protect
            permissions={{ i3Item: ["return"] }}
            render={(hasPermission) => {
                const reason = disabledReason(hasPermission);

                return (
                    <>
                        {/* The tooltip wraps the button either way, so the button keeps its DOM
                            node (and focus) when a Return flips it to disabled. */}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    ref={buttonRef}
                                    variant="outline"
                                    size="sm"
                                    aria-disabled={reason !== null}
                                    className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                                    onClick={() => {
                                        if (reason === null) {
                                            void setAction("return", { history: "push" });
                                        }
                                    }}
                                >
                                    <PackageCheckIcon />
                                    Return
                                </Button>
                            </TooltipTrigger>
                            {reason !== null && <TooltipContent>{reason}</TooltipContent>}
                        </Tooltip>
                        <D4HI3Module_ReturnEquipmentItem_Dialog
                            teamId={teamId}
                            itemId={item.id}
                            itemLabel={`#${item.ref} ${item.kind.title}`}
                            holder={holder}
                            canReturn={reason === null}
                            returnFocusRef={buttonRef}
                        />
                    </>
                );
            }}
        />
    );
}
