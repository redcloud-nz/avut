/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Item } from "@/components/ui/item";
import type { SelfAuditStatus } from "@/lib/schemas/self-audit";

import { STATUS_LABELS, STATUS_ORDER } from "./campaign-labels";

/**
 * A self audit campaign's members by status: one count tile per status, above the members table.
 * A tile filters the table to its status; the active tile (the only status filtered on) clears
 * the filter again.
 */
export function D4HI3Module_SelfAuditCampaign_StatusStrip({
    counts,
    activeStatus,
    onSelect,
}: {
    counts: Record<SelfAuditStatus, number>;
    /** The status the table is filtered to alone, if any. */
    activeStatus: SelfAuditStatus | null;
    /** Called with the status to filter to, or null to clear the filter. */
    onSelect: (status: SelfAuditStatus | null) => void;
}) {
    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-8">
            {STATUS_ORDER.map((status) => {
                const active = status === activeStatus;
                return (
                    <Item
                        key={status}
                        variant="outline"
                        data-active={active ? "" : undefined}
                        asChild
                    >
                        <button
                            type="button"
                            aria-pressed={active}
                            onClick={() => onSelect(active ? null : status)}
                        >
                            <div className="flex flex-col items-start gap-1">
                                <span className="text-2xl font-semibold tabular-nums">
                                    {counts[status]}
                                </span>
                                <span className="text-sm text-muted-foreground group-data-active/item:text-selected-foreground">
                                    {STATUS_LABELS[status]}
                                </span>
                            </div>
                        </button>
                    </Item>
                );
            })}
        </div>
    );
}
