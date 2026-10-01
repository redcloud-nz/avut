/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { MessageSquareTextIcon, MoreHorizontalIcon } from "lucide-react";

import { SkillCheckResultIcon } from "@/components/skill-track/result-icon";
import { Button } from "@/components/ui/button";
import { FieldContent, FieldLabel } from "@/components/ui/field";
import {
    SKILL_CHECK_FAIL_TIERS,
    SKILL_CHECK_PASS_TIERS,
    type SkillCheckResultOption,
    type SkillCheckResultValue,
} from "@/lib/schemas/skill-check";
import type { OtherAssessorCheck } from "@/lib/session-checks-sync";
import { cn } from "@/lib/utils";

type CheckValue = { result: SkillCheckResultValue; notes: string };

interface CheckRowProps {
    title: string;
    /** The caller's saved check for this row, or null if there isn't one. */
    check: CheckValue | null;
    /**
     * The value of a write in flight for this row (from `usePendingChecks`): the pending result,
     * `null` for a pending delete, or `undefined` when nothing is pending.
     */
    pending: SkillCheckResultValue | null | undefined;
    /** The org's enabled results, from `getEnabledSkillCheckResultOptions`. */
    resultOptions: SkillCheckResultOption[];
    /** The org's label for any result, enabled or not (`getSkillCheckResultLabel`). */
    resultLabel: (value: SkillCheckResultValue) => string;
    onRecord: (value: CheckValue) => void;
    onRemove: () => void;
    /** Opens the host's `SkillTrack_RecordCheckDialog` for this row. */
    onOpenDialog: () => void;
    /**
     * The other assessors' live checks on this (assessee, skill) pair (from
     * `otherAssessorChecks`), shown as "Also checked by …" under the title. Never the caller's own.
     */
    otherChecks?: OtherAssessorCheck[];
}

const QUICK_BUTTONS = [
    { tiers: SKILL_CHECK_FAIL_TIERS, mid: "Fail", ariaLabel: "Not Yet Competent" },
    { tiers: SKILL_CHECK_PASS_TIERS, mid: "Pass", ariaLabel: "Competent" },
] as const satisfies readonly {
    tiers: readonly SkillCheckResultValue[];
    mid: SkillCheckResultValue;
    ariaLabel: string;
}[];

/**
 * One (assessee, skill) row on a session's recording page: a Fail and a Pass button, then `More`.
 *
 * - Each button records one result: its family's mid tier, or the first enabled tier if the org
 *   has disabled the mid one. A family with no enabled tier has no button.
 * - Tapping an inactive button records its result. Tapping the active one clears the check, or
 *   opens the dialog if the check has notes, so a stray tap can't drop them.
 * - Any other result (another tier, or `NotTaught`/`Exempt`/…) shows its label in place of the
 *   buttons. `More` opens the dialog, which records any result, notes, or deletes.
 *
 * While a write is pending the row shows the pending value dimmed, with its buttons disabled, so
 * two writes to one check can't reorder.
 *
 * With `otherChecks`, an "Also checked by Jane (Competent), …" line goes under the title, using the
 * org's result labels.
 */
export function SkillTrack_CheckRow({
    title,
    check,
    pending,
    resultOptions,
    resultLabel,
    onRecord,
    onRemove,
    onOpenDialog,
    otherChecks,
}: CheckRowProps) {
    const isPending = pending !== undefined;
    const shownResult = isPending ? pending : (check?.result ?? null);
    const hasNotes = shownResult !== null && !!check?.notes;

    const enabled = new Set(resultOptions.map((option) => option.value));
    const buttons = QUICK_BUTTONS.flatMap(({ tiers, mid, ariaLabel }) => {
        const result = enabled.has(mid) ? mid : tiers.find((value) => enabled.has(value));
        return result ? [{ result, ariaLabel }] : [];
    });
    const showsLabel =
        shownResult !== null && !buttons.some((button) => button.result === shownResult);

    const alsoCheckedBy = otherChecks?.length
        ? `Also checked by ${otherChecks
              .map(({ assessorName, result }) => `${assessorName} (${resultLabel(result)})`)
              .join(", ")}`
        : null;

    function handleTap(result: SkillCheckResultValue) {
        if (result !== shownResult) {
            onRecord({ result, notes: check?.notes ?? "" });
        } else if (check?.notes) {
            // Clearing would drop the notes too, so show them and leave Delete to the dialog.
            onOpenDialog();
        } else {
            onRemove();
        }
    }

    return (
        <div className="flex items-center gap-2">
            {alsoCheckedBy ? (
                <FieldContent className="grow">
                    <FieldLabel>{title}</FieldLabel>
                    <p className="text-xs text-muted-foreground">{alsoCheckedBy}</p>
                </FieldContent>
            ) : (
                <FieldLabel className="grow">{title}</FieldLabel>
            )}

            <div
                className={cn("flex items-center gap-1", isPending && "opacity-50")}
                aria-busy={isPending || undefined}
            >
                {hasNotes && (
                    <MessageSquareTextIcon
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-label="Has notes"
                        role="img"
                    />
                )}

                {showsLabel ? (
                    <span className="px-1 text-sm whitespace-nowrap text-muted-foreground">
                        {resultLabel(shownResult)}
                    </span>
                ) : (
                    buttons.map(({ result, ariaLabel }) => {
                        const active = result === shownResult;
                        return (
                            <Button
                                key={result}
                                variant={active ? "outline" : "ghost"}
                                size="icon"
                                aria-label={ariaLabel}
                                aria-pressed={active}
                                disabled={isPending}
                                onClick={() => handleTap(result)}
                            >
                                <SkillCheckResultIcon result={result} />
                            </Button>
                        );
                    })
                )}

                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="More options"
                    disabled={isPending}
                    onClick={onOpenDialog}
                >
                    <MoreHorizontalIcon />
                </Button>
            </div>
        </div>
    );
}
