/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { Item } from "@/components/ui/item";

interface SessionReviewSummaryProps {
    /** Distinct assessee and skill pairs with a live check: two assessors on one pair count once. */
    uniqueCheckCount: number;
    /** People with at least one live check. */
    personnelCount: number;
    /** Skills with at least one live check. */
    skillCount: number;
    /** The share of counted assessee and skill pairs with a live check, as a whole percentage. */
    coveragePercent: number;
}

/**
 * The review page's summary strip: four tiles above the cards. Personnel, Skills and Coverage link
 * to the Personnel and Skills cards.
 */
export function SkillTrack_SessionReview_Summary({
    uniqueCheckCount,
    personnelCount,
    skillCount,
    coveragePercent,
}: SessionReviewSummaryProps) {
    return (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <SummaryTile value={uniqueCheckCount} label="Unique checks" />
            <SummaryTile value={personnelCount} label="Personnel" href="#coverage" />
            <SummaryTile value={skillCount} label="Skills" href="#coverage" />
            <SummaryTile value={`${coveragePercent}%`} label="Coverage" href="#coverage" />
        </div>
    );
}

function SummaryTile({
    value,
    label,
    href,
}: {
    value: number | string;
    label: string;
    /** An in-page link to the tile's card. */
    href?: `#${string}`;
}) {
    const content = (
        <div className="flex flex-col gap-1">
            <span className="text-2xl font-semibold">{value}</span>
            <span className="text-sm text-muted-foreground">{label}</span>
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
