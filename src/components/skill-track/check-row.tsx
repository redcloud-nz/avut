/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { MessageSquareTextIcon, PencilIcon, PlusIcon } from "lucide-react";

import type { RecordCheckDensity } from "@/components/skill-track/record-check-dialog";
import { SkillCheckResultIcon } from "@/components/skill-track/result-icon";
import { Button } from "@/components/ui/button";
import { FieldContent, FieldDescription, FieldLabel } from "@/components/ui/field";
import type { SkillCheckResultOption, SkillCheckResultValue } from "@/lib/schemas/skill-check";
import { cn } from "@/lib/utils";

type CheckValue = { result: SkillCheckResultValue; notes: string };

export type RecordingMode = "quick" | "dialog";

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
 * In dialog mode it shows the check's result (or "Not recorded") and an edit/add button that
 * opens the host's `SkillTrack_RecordCheckDialog` compact. While a write is pending the row shows
 * the pending value dimmed, with its buttons disabled, so two writes to one check can't reorder.
 */
export function SkillTrack_CheckRow({
    title,
    description,
    check,
    pending,
    resultLabel,
    onOpenDialog,
}: CheckRowProps) {
    // Quick Mode's Fail/Pass buttons aren't built yet, so every mode renders the dialog layout.
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
            </div>
        </div>
    );
}
