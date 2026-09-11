/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Badge } from "@/components/ui/badge";
import { formatD4HMemberStatus } from "@/lib/schemas/d4h/member";
import { cn } from "@/lib/utils";

/**
 * Read-only badge for a D4H member status (`OPERATIONAL` / `NON_OPERATIONAL` /
 * `OBSERVER` / `RETIRED`, or any future raw value). Display-only — AVUT never
 * edits this; it is a snapshot refreshed by D4H sync.
 */
export function D4HMemberStatusBadge({ status }: { status: string }) {
    return (
        <Badge variant="outline" className={cn("font-normal", toneFor(status))}>
            {formatD4HMemberStatus(status)}
        </Badge>
    );
}

function toneFor(status: string): string | undefined {
    switch (status) {
        case "OPERATIONAL":
            return "border-green-600/30 text-green-700 dark:text-green-400";
        case "NON_OPERATIONAL":
            return "border-amber-600/30 text-amber-700 dark:text-amber-400";
        case "RETIRED":
            return "text-muted-foreground";
        default:
            return undefined;
    }
}
