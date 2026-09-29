/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { MessageSquareTextIcon, MoreHorizontalIcon, PencilIcon, PlusIcon } from "lucide-react";
import * as z from "zod";

import {
    FAIL_TIERS,
    PASS_TIERS,
    type RecordCheckDensity,
} from "@/components/skill-track/record-check-dialog";
import { SkillCheckResultIcon } from "@/components/skill-track/result-icon";
import { Button } from "@/components/ui/button";
import { FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import { useLocalStorageState } from "@/hooks/use-local-storage-state";
import type { SkillCheckResultOption, SkillCheckResultValue } from "@/lib/schemas/skill-check";
import { cn } from "@/lib/utils";

type CheckValue = { result: SkillCheckResultValue; notes: string };

const RecordingModeSchema = z.enum(["quick", "dialog"]);
export type RecordingMode = z.infer<typeof RecordingModeSchema>;

/**
 * The recording mode chosen in the entry pages' Actions sheet, remembered per browser and shared
 * by both entry pages. Defaults to Quick Mode.
 */
export function useRecordingMode() {
    return useLocalStorageState("avut:skill-track:recording-mode", RecordingModeSchema, "quick");
}

interface CheckRowProps {
    title: string;
    description?: string;
    /** The caller's saved check for this row, or null if there isn't one. */
    check: CheckValue | null;
    /**
     * The value of a write in flight for this row (from `usePendingChecks`): the pending result,
     * `null` for a pending delete, or `undefined` when nothing is pending.
     */
    pending: SkillCheckResultValue | null | undefined;
    mode: RecordingMode;
    /** The org's enabled results, from `getEnabledSkillCheckResultOptions`. */
    resultOptions: SkillCheckResultOption[];
    /** The org's label for any result, enabled or not (`getSkillCheckResultLabel`). */
    resultLabel: (value: SkillCheckResultValue) => string;
    onRecord: (value: CheckValue) => void;
    onRemove: () => void;
    onOpenDialog: (density: RecordCheckDensity) => void;
}

/**
 * One (assessee, skill) row on a session's recording page.
 *
 * - **Quick Mode** shows Fail and Pass buttons. Tapping an inactive one records its family's mid
 *   tier; tapping the active one clears the check, or opens the dialog expanded if the check has
 *   notes. A result outside both families shows its label instead. `More` opens the dialog
 *   expanded.
 * - **Dialog mode** shows the check's result (or "Not recorded") and an edit/add button that
 *   opens the host's `SkillTrack_RecordCheckDialog` compact.
 *
 * While a write is pending the row shows the pending value dimmed, with its buttons disabled, so
 * two writes to one check can't reorder.
 */
export function SkillTrack_CheckRow({
    title,
    description,
    check,
    pending,
    mode,
    resultOptions,
    resultLabel,
    onRecord,
    onRemove,
    onOpenDialog,
}: CheckRowProps) {
    const isPending = pending !== undefined;
    const shownResult = isPending ? pending : (check?.result ?? null);
    const hasNotes = shownResult !== null && !!check?.notes;

    return (
        <div className="flex items-center gap-2">
            {description ? (
                <FieldContent className="grow">
                    <FieldLabel>{title}</FieldLabel>
                    <FieldDescription>{description}</FieldDescription>
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

                {mode === "quick" ? (
                    <QuickControls
                        check={check}
                        shownResult={shownResult}
                        disabled={isPending}
                        resultOptions={resultOptions}
                        resultLabel={resultLabel}
                        onRecord={onRecord}
                        onRemove={onRemove}
                        onOpenDialog={onOpenDialog}
                    />
                ) : (
                    <>
                        {shownResult !== null ? (
                            <span className="flex items-center gap-1.5 px-1 text-sm whitespace-nowrap">
                                <SkillCheckResultIcon result={shownResult} />
                                {resultLabel(shownResult)}
                            </span>
                        ) : (
                            <span className="px-1 text-sm whitespace-nowrap text-muted-foreground">
                                Not recorded
                            </span>
                        )}

                        <Button
                            variant="ghost"
                            size="icon"
                            aria-label={check ? "Edit check" : "Add check"}
                            disabled={isPending}
                            onClick={() => onOpenDialog("compact")}
                        >
                            {check ? <PencilIcon /> : <PlusIcon />}
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}

const QUICK_FAMILIES = [
    { tiers: FAIL_TIERS, mid: "Fail", ariaLabel: "Not Yet Competent" },
    { tiers: PASS_TIERS, mid: "Pass", ariaLabel: "Competent" },
] as const satisfies readonly {
    tiers: readonly SkillCheckResultValue[];
    mid: SkillCheckResultValue;
    ariaLabel: string;
}[];

/** Quick Mode's Fail/Pass buttons (or the other-value label), then `More`. */
function QuickControls({
    check,
    shownResult,
    disabled,
    resultOptions,
    resultLabel,
    onRecord,
    onRemove,
    onOpenDialog,
}: Pick<
    CheckRowProps,
    "check" | "resultOptions" | "resultLabel" | "onRecord" | "onRemove" | "onOpenDialog"
> & {
    shownResult: SkillCheckResultValue | null;
    disabled: boolean;
}) {
    const enabled = new Set(resultOptions.map((option) => option.value));
    const isOtherValue =
        shownResult !== null &&
        !FAIL_TIERS.includes(shownResult) &&
        !PASS_TIERS.includes(shownResult);

    function handleTap(active: boolean, tier: SkillCheckResultValue) {
        if (!active) {
            onRecord({ result: tier, notes: check?.notes ?? "" });
        } else if (check?.notes) {
            // Clearing would drop the notes too, so show them and leave Delete to the dialog.
            onOpenDialog("expanded");
        } else {
            onRemove();
        }
    }

    return (
        <>
            {isOtherValue ? (
                <span className="px-1 text-sm whitespace-nowrap text-muted-foreground">
                    {resultLabel(shownResult)}
                </span>
            ) : (
                QUICK_FAMILIES.map(({ tiers, mid, ariaLabel }) => {
                    // The mid tier, or the first enabled tier if the org has disabled it. A
                    // family with no enabled tier has no button.
                    const tier: SkillCheckResultValue | undefined = enabled.has(mid)
                        ? mid
                        : tiers.find((value) => enabled.has(value));
                    if (!tier) return null;

                    // Active across the whole family, so a tier the org has since disabled
                    // still shows as recorded.
                    const activeTier =
                        shownResult !== null && tiers.includes(shownResult) ? shownResult : null;
                    const active = activeTier !== null;

                    return (
                        <Button
                            key={mid}
                            variant={active ? "outline" : "ghost"}
                            size="icon"
                            aria-label={ariaLabel}
                            aria-pressed={active}
                            disabled={disabled}
                            onClick={() => handleTap(active, tier)}
                        >
                            <SkillCheckResultIcon result={activeTier ?? tier} />
                        </Button>
                    );
                })
            )}

            <Button
                variant="ghost"
                size="icon"
                aria-label="More options"
                disabled={disabled}
                onClick={() => onOpenDialog("expanded")}
            >
                <MoreHorizontalIcon />
            </Button>
        </>
    );
}
