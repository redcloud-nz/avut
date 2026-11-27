/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { SelfAuditStatus } from "@/lib/schemas/self-audit";

/** How the admin pages name a request's status. `Sent` includes a send not yet confirmed. */
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

/** A self audit campaign's requests by status, as "2 submitted, 1 sent", or "—" with none. */
export function describeStatusCounts(counts: Record<SelfAuditStatus, number>): string {
    const shown = Object.entries(STATUS_LABELS)
        .map(([status, label]) => [counts[status as SelfAuditStatus], label] as const)
        .filter(([count]) => count > 0)
        .map(([count, label]) => `${count} ${label.toLowerCase()}`);
    return shown.length > 0 ? shown.join(", ") : "—";
}
