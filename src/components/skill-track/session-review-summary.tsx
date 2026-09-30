/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Item } from "@/components/ui/item";
import { cn } from "@/lib/utils";

interface SessionReviewSummaryProps {
    /** Checks the approval includes: what Approve would submit, or the stored `Include`s. */
    includedCount: number;
    /** Every other check in the session. */
    excludedCount: number;
    /** Conflict groups in the session, resolved or not. */
    conflictCount: number;
    /** Conflict groups with no pick yet. Ignored when `showApproval`. */
    unresolvedConflicts: number;
    /** Assigned assessee and skill pairs with no live check. */
    notAssessedCount: number;
    /** The approval is shown: every conflict was resolved at approval, so show the total. */
    showApproval: boolean;
}

/**
 * The review page's summary strip: four count tiles above the cards. Conflicts and Not assessed
 * link to their cards when there's anything in them.
 */
export function SkillTrack_SessionReview_Summary({
    includedCount,
    excludedCount,
    conflictCount,
    unresolvedConflicts,
    notAssessedCount,
    showApproval,
}: SessionReviewSummaryProps) {
    const showUnresolved = !showApproval && unresolvedConflicts > 0;

    return (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <SummaryTile value={includedCount} label="Included" />
            <SummaryTile value={excludedCount} label="Excluded" />
            {showUnresolved ? (
                <SummaryTile
                    value={unresolvedConflicts}
                    label="Unresolved conflicts"
                    href="#conflicts"
                    highlight
                />
            ) : (
                <SummaryTile
                    value={conflictCount}
                    label="Conflicts"
                    href={conflictCount > 0 ? "#conflicts" : undefined}
                />
            )}
            <SummaryTile
                value={notAssessedCount}
                label="Not assessed"
                href={notAssessedCount > 0 ? "#not-assessed" : undefined}
            />
        </div>
    );
}

function SummaryTile({
    value,
    label,
    href,
    highlight = false,
}: {
    value: number;
    label: string;
    /** An in-page link to the tile's card. Leave it out when there's no card to go to. */
    href?: `#${string}`;
    /** Draw the number and label in the destructive colour, for counts that need action. */
    highlight?: boolean;
}) {
    const content = (
        <div className={cn("flex flex-col gap-1", highlight && "text-destructive")}>
            <span className="text-2xl font-semibold">{value}</span>
            <span
                className={cn("text-sm", highlight ? "text-destructive" : "text-muted-foreground")}
            >
                {label}
            </span>
        </div>
    );

    return href ? (
        <Item variant="outline" asChild>
            <a href={href}>{content}</a>
        </Item>
    ) : (
        <Item variant="outline">{content}</Item>
    );
}
