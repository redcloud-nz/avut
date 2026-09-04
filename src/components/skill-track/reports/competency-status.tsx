/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { match } from "ts-pattern";

import { CircleCheckIcon, CircleXIcon, ClockIcon, MinusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isCompetentResult, type SkillCheckResultValue } from "@/lib/schemas/skill-check";

export type CompetencyStatus = "current" | "expired" | "not-competent" | "not-assessed";

/**
 * The status ladder shared by every skill-track competency report: a missing check reads as
 * "not assessed", a non-competent result is a fail regardless of recency, and expiry only
 * matters for an otherwise-competent result.
 */
export function deriveStatus(
    competency: { result: SkillCheckResultValue; isCurrent: boolean } | undefined,
): CompetencyStatus {
    return !competency
        ? "not-assessed"
        : !isCompetentResult(competency.result)
          ? "not-competent"
          : competency.isCurrent
            ? "current"
            : "expired";
}

/** Zeroed tally of every status — a starting point for {@link tallyStatuses}. */
export function emptyStatusCounts(): Record<CompetencyStatus, number> {
    return { current: 0, expired: 0, "not-competent": 0, "not-assessed": 0 };
}

/** Count how many of `statuses` fall into each bucket. */
export function tallyStatuses(
    statuses: Iterable<CompetencyStatus>,
): Record<CompetencyStatus, number> {
    const counts = emptyStatusCounts();
    for (const status of statuses) counts[status] += 1;
    return counts;
}

export const STATUS_LABELS: Record<CompetencyStatus, string> = {
    current: "Current",
    expired: "Expired",
    "not-competent": "Not Competent",
    "not-assessed": "Not Assessed",
};

/** Tailwind background classes for the segmented bar in the team/org overview report. */
export const STATUS_BAR_COLORS: Record<CompetencyStatus, string> = {
    current: "bg-green-600",
    expired: "bg-amber-500",
    "not-competent": "bg-destructive",
    "not-assessed": "bg-muted-foreground/30",
};

export function StatusBadge({ status }: { status: CompetencyStatus }) {
    return match(status)
        .with("current", () => (
            <Badge
                variant="outline"
                className="border-green-600 text-green-700 dark:text-green-500"
            >
                Current
            </Badge>
        ))
        .with("expired", () => (
            <Badge
                variant="outline"
                className="border-amber-600 text-amber-700 dark:text-amber-500"
            >
                Expired
            </Badge>
        ))
        .with("not-competent", () => <Badge variant="destructive">Not Competent</Badge>)
        .with("not-assessed", () => <Badge variant="secondary">Not Assessed</Badge>)
        .exhaustive();
}

/**
 * Compact icon form of {@link StatusBadge}, for dense grids where a text badge doesn't fit.
 * Carries an accessible label via `title` / `aria-label`.
 */
export function StatusIcon({
    status,
    className,
}: {
    status: CompetencyStatus;
    className?: string;
}) {
    const label = STATUS_LABELS[status];
    const iconClass = cn("size-4", className);

    return match(status)
        .with("current", () => (
            <CircleCheckIcon
                className={cn(iconClass, "text-green-600 dark:text-green-500")}
                aria-label={label}
            />
        ))
        .with("expired", () => (
            <ClockIcon
                className={cn(iconClass, "text-amber-600 dark:text-amber-500")}
                aria-label={label}
            />
        ))
        .with("not-competent", () => (
            <CircleXIcon className={cn(iconClass, "text-destructive")} aria-label={label} />
        ))
        .with("not-assessed", () => (
            <MinusIcon className={cn(iconClass, "text-muted-foreground/50")} aria-label={label} />
        ))
        .exhaustive();
}
