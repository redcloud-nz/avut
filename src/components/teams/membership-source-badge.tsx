/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatRelativeDateTime } from "@/lib/datetime";
import { type RouterOutput } from "@/trpc/client";

export type TeamMembershipListItem = RouterOutput["teams"]["listTeamMemberships"][number];

/**
 * Marks a team membership as D4H-managed or manually added.
 *
 * - D4H-managed (`membership.d4h != null`) → a "D4H" badge, on every surface.
 * - Manual, on a D4H-linked team (`teamIsD4HLinked`) → a "Manual" badge, so an
 *   admin can see which rows the next sync will leave alone.
 * - Manual, on a plain team → nothing (the distinction carries no information).
 *
 * `lastSyncedAt` is the team-level `Team_D4H.lastSyncedAt` — there is no
 * per-membership sync timestamp. Omit it where the surface has no team context.
 */
export function MembershipSourceBadge({
    membership,
    teamIsD4HLinked = false,
    lastSyncedAt,
}: {
    membership: Pick<TeamMembershipListItem, "d4h">;
    teamIsD4HLinked?: boolean;
    lastSyncedAt?: string | null;
}) {
    if (membership.d4h != null) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <Badge variant="outline" className="font-normal">
                        D4H
                    </Badge>
                </TooltipTrigger>
                <TooltipContent>
                    Managed by D4H sync
                    {lastSyncedAt ? ` — last synced ${formatRelativeDateTime(lastSyncedAt)}` : ""}
                </TooltipContent>
            </Tooltip>
        );
    }

    if (!teamIsD4HLinked) return null;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <Badge variant="outline" className="font-normal text-muted-foreground">
                    Manual
                </Badge>
            </TooltipTrigger>
            <TooltipContent>Added in AVUT — not affected by D4H sync</TooltipContent>
        </Tooltip>
    );
}
