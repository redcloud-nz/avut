/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { KitCheckDeliveryStatus, KitCheckProgress } from "@/lib/schemas/kit-check";

/** How the admin pages name a request's last send. `Pending` is a send not yet confirmed. */
export const DELIVERY_LABELS: Record<KitCheckDeliveryStatus, string> = {
    Pending: "Sending",
    Sent: "Sent",
    Failed: "Failed",
    NoEmail: "No email",
};

export const PROGRESS_LABELS: Record<KitCheckProgress, string> = {
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

/** A kit check's requests by delivery, as "3 sent, 1 no email". */
export function describeDeliveryCounts(counts: Record<KitCheckDeliveryStatus, number>): string {
    return describeCounts([
        [counts.Sent, "sent"],
        [counts.Failed, "failed"],
        [counts.NoEmail, "no email"],
        [counts.Pending, "sending"],
    ]);
}

/** A kit check's requests by progress, as "2 submitted, 1 not opened". */
export function describeProgressCounts(counts: Record<KitCheckProgress, number>): string {
    return describeCounts([
        [counts.Submitted, "submitted"],
        [counts.Editing, "editing"],
        [counts.Opened, "opened"],
        [counts.NotOpened, "not opened"],
    ]);
}
