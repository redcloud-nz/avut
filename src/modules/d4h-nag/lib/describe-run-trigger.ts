/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { D4HNagRunTrigger } from "@/lib/schemas/d4h-nag";

const TRIGGER_LABELS: Record<D4HNagRunTrigger, string> = {
    Cron: "Scheduled",
    Manual: "Manual",
};

/** What started a run, in words. Shared by the runs table and the run page. */
export function describeRunTrigger(trigger: D4HNagRunTrigger): string {
    return TRIGGER_LABELS[trigger];
}
