/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { Badge } from "@/components/ui/badge";
import { formatD4HMemberStatus } from "@/lib/schemas/d4h/member";

/**
 * Read-only badge for a D4H member status (`OPERATIONAL` / `NON_OPERATIONAL` /
 * `OBSERVER` / `RETIRED`, or any future raw value). Display-only — AVUT never
 * edits this; it is a snapshot refreshed by D4H sync.
 */
export function D4HMemberStatusBadge({ status }: { status: string }) {
    return (
        <Badge
            variant={variantFor(status)}
            className={status === "RETIRED" ? "font-normal text-muted-foreground" : "font-normal"}
        >
            {formatD4HMemberStatus(status)}
        </Badge>
    );
}

function variantFor(status: string) {
    switch (status) {
        case "OPERATIONAL":
            return "success-outline";
        case "NON_OPERATIONAL":
            return "warning-outline";
        default:
            return "outline";
    }
}
