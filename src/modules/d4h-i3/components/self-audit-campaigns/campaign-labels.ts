/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { ComponentProps } from "react";

import type { Badge } from "@/components/ui/badge";
import type { SelfAuditStatus } from "@/lib/schemas/self-audit";

/**
 * How the admin pages name a request's status, in precedence order (Withdrawn first, Not sent
 * last), which is also the order the status strip and the Status filter list them in. `Sent`
 * includes a send not yet confirmed.
 */
export const STATUS_LABELS: Record<SelfAuditStatus, string> = {
    Withdrawn: "Withdrawn",
    Submitted: "Submitted",
    Editing: "Editing",
    Opened: "Opened",
    Failed: "Failed",
    NoEmail: "No email",
    Sent: "Sent",
    Unsent: "Not sent",
};

/** Every status, in `STATUS_LABELS` order. */
export const STATUS_ORDER = Object.keys(STATUS_LABELS) as SelfAuditStatus[];

/** The badge each status renders as. */
export const STATUS_BADGES: Record<SelfAuditStatus, ComponentProps<typeof Badge>["variant"]> = {
    Withdrawn: "outline",
    Submitted: "success-outline",
    Editing: "info-outline",
    Opened: "info-outline",
    Failed: "destructive-outline",
    NoEmail: "warning-outline",
    Sent: "outline",
    Unsent: "outline",
};

/**
 * How many of a campaign's members have submitted, as "2 of 5", or "—" with no members. Withdrawn
 * members count in neither number.
 */
export function describeSubmitted(counts: Record<SelfAuditStatus, number>): string {
    const members = Object.values(counts).reduce((sum, count) => sum + count, 0) - counts.Withdrawn;
    return members > 0 ? `${counts.Submitted} of ${members}` : "—";
}

/** "3 sent, 1 failed, 1 with no email", leaving out the zero counts (but never empty). */
export function describeSendOutcome({
    sent,
    failed,
    noEmail,
}: {
    sent: number;
    failed: number;
    noEmail: number;
}): string {
    const parts = [
        sent > 0 && `${sent} sent`,
        failed > 0 && `${failed} failed`,
        noEmail > 0 && `${noEmail} with no email`,
    ].filter((part): part is string => typeof part === "string");
    return parts.length > 0 ? parts.join(", ") : "nothing sent";
}
