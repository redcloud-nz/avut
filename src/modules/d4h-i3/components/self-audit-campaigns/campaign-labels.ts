/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { SelfAuditDeliveryStatus, SelfAuditProgress } from "@/lib/schemas/self-audit";

/** How the admin pages name a request's last send. `Pending` is a send not yet confirmed. */
export const DELIVERY_LABELS: Record<SelfAuditDeliveryStatus, string> = {
    Pending: "Sending",
    Sent: "Sent",
    Failed: "Failed",
    NoEmail: "No email",
};

export const PROGRESS_LABELS: Record<SelfAuditProgress, string> = {
    NotOpened: "Not opened",
    Opened: "Opened",
    Submitted: "Submitted",
    Editing: "Editing",
};

/** Joins the non-zero counts as "3 sent, 1 failed", or "—" when every count is zero. */
function describeCounts(parts: [count: number, label: string][]): string {
    const shown = parts.filter(([count]) => count > 0).map(([count, label]) => `${count} ${label}`);
    return shown.length > 0 ? shown.join(", ") : "—";
}

/** A self audit campaign's requests by delivery, as "3 sent, 1 no email". */
export function describeDeliveryCounts(counts: Record<SelfAuditDeliveryStatus, number>): string {
    return describeCounts([
        [counts.Sent, "sent"],
        [counts.Failed, "failed"],
        [counts.NoEmail, "no email"],
        [counts.Pending, "sending"],
    ]);
}

/** A self audit campaign's requests by progress, as "2 submitted, 1 not opened". */
export function describeProgressCounts(counts: Record<SelfAuditProgress, number>): string {
    return describeCounts([
        [counts.Submitted, "submitted"],
        [counts.Editing, "editing"],
        [counts.Opened, "opened"],
        [counts.NotOpened, "not opened"],
    ]);
}
