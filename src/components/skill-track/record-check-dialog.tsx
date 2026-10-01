/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";

import { RESULT_ICONS } from "@/components/skill-track/result-icon";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogBody,
    DialogCloseButton,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
    SKILL_CHECK_FAIL_TIERS,
    SKILL_CHECK_PASS_TIERS,
    SKILL_CHECK_RESULT_VALUES,
    SkillCheckResultValue,
    type SkillCheckResultOption,
} from "@/lib/schemas/skill-check";
import { cn } from "@/lib/utils";

type CheckValue = { result: SkillCheckResultValue; notes: string };

interface RecordCheckDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /**
     * Opaque id of the (assessee, skill) pair, e.g. `sessionCheckKey(assesseeId, skillId)`.
     * Changing it while the dialog is open resets the staged state.
     */
    targetKey: string;
    skillName: string;
    /** The skill's description, shown under the skill name when it's set. */
    skillDescription?: string;
    personName: string;
    /** The caller's saved check for this assessee and skill, or null if there isn't one. */
    current: CheckValue | null;
    /** The org's enabled results, from `getEnabledSkillCheckResultOptions`. */
    resultOptions: SkillCheckResultOption[];
    /**
     * The org's label for any result, enabled or not (`getSkillCheckResultLabel`). Used for a
     * current result the org has since disabled, which `resultOptions` leaves out.
     */
    resultLabel: (value: SkillCheckResultValue) => string;
    onRecord: (value: CheckValue) => void;
    onDelete: () => void;
}

/**
 * Records one skill check for an (assessee, skill) pair on a session's recording page: one
 * button per enabled result stages it, with a notes field and Cancel / Delete / Save. Save is
 * enabled once the staged pair differs from `current`. The header shows the person, the skill, and
 * the skill's description when there is one; this is the only place the entry pages show it.
 *
 * Controlled and mutation-free: the host owns `open` and supplies `onRecord`/`onDelete` from
 * `useSessionCheckRecorder`. The host should keep its target in place while closing (set `open`
 * false only), so the title and grid don't blank out during the exit animation.
 */
export function SkillTrack_RecordCheckDialog({
    open,
    onOpenChange,
    targetKey,
    skillName,
    skillDescription,
    personName,
    current,
    resultOptions,
    resultLabel,
    onRecord,
    onDelete,
}: RecordCheckDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent mobile="sheet">
                <DialogHeader>
                    <DialogTitle>{personName}</DialogTitle>
                    <DialogDescription>{skillName}</DialogDescription>
                    {skillDescription && (
                        <p className="text-xs text-muted-foreground">{skillDescription}</p>
                    )}
                </DialogHeader>
                <RecordCheck_Body
                    // Radix unmounts the content on close, which resets the body on every reopen.
                    // The key covers the target changing while the dialog stays open.
                    key={targetKey}
                    current={current}
                    resultOptions={resultOptions}
                    resultLabel={resultLabel}
                    onRecord={onRecord}
                    onDelete={onDelete}
                    onClose={() => onOpenChange(false)}
                />
            </DialogContent>
        </Dialog>
    );
}

function RecordCheck_Body({
    current,
    resultOptions,
    resultLabel,
    onRecord,
    onDelete,
    onClose,
}: Pick<
    RecordCheckDialogProps,
    "current" | "resultOptions" | "resultLabel" | "onRecord" | "onDelete"
> & { onClose: () => void }) {
    const [stagedResult, setStagedResult] = useState<SkillCheckResultValue | null>(
        current?.result ?? null,
    );
    const [stagedNotes, setStagedNotes] = useState(current?.notes ?? "");

    const options = orderResultOptions(resultOptions, current?.result ?? null, resultLabel);

    function handleSave() {
        if (stagedResult === null) return;
        onRecord({ result: stagedResult, notes: stagedNotes });
        onClose();
    }

    function handleDelete() {
        onDelete();
        onClose();
    }

    const changed = stagedResult !== current?.result || stagedNotes !== (current?.notes ?? "");

    return (
        <>
            <DialogBody>
                <div className="flex flex-wrap gap-2 *:flex-1">
                    {options.map((option) => {
                        const { Icon, className } = RESULT_ICONS[option.value];
                        const isSelected = option.value === stagedResult;
                        return (
                            <Button
                                key={option.value}
                                variant={isSelected ? "outline" : "ghost"}
                                aria-pressed={isSelected}
                                className="h-auto min-w-0 flex-col justify-start gap-1.5 px-1 py-1.5 text-[0.625rem] leading-tight font-normal whitespace-normal"
                                onClick={() => setStagedResult(option.value)}
                            >
                                <Icon className={cn("size-5", className)} />
                                <span className="text-muted-foreground">{option.label}</span>
                            </Button>
                        );
                    })}
                </div>

                <Textarea
                    aria-label="Notes"
                    placeholder="Notes..."
                    value={stagedNotes}
                    onChange={(e) => setStagedNotes(e.target.value)}
                />
            </DialogBody>

            <DialogFooter>
                {current && (
                    <Button variant="destructive" className="mr-auto" onClick={handleDelete}>
                        Delete
                    </Button>
                )}
                <DialogCloseButton variant="outline">Cancel</DialogCloseButton>
                <Button disabled={stagedResult === null || !changed} onClick={handleSave}>
                    Save
                </Button>
            </DialogFooter>
        </>
    );
}

/**
 * The result buttons, in one wrapping row: fail tiers, pass tiers, then everything else, each
 * in `SKILL_CHECK_RESULT_VALUES` order. The current result is always included, even if the org
 * has since disabled it, so an existing check keeps its active button.
 */
function orderResultOptions(
    resultOptions: SkillCheckResultOption[],
    currentResult: SkillCheckResultValue | null,
    resultLabel: (value: SkillCheckResultValue) => string,
): SkillCheckResultOption[] {
    const labels = new Map(resultOptions.map((option) => [option.value, option.label]));
    if (currentResult !== null && !labels.has(currentResult)) {
        labels.set(currentResult, resultLabel(currentResult));
    }

    const options = SKILL_CHECK_RESULT_VALUES.flatMap((value) => {
        const label = labels.get(value);
        return label === undefined ? [] : [{ value, label }];
    });

    return [
        ...options.filter((option) => SKILL_CHECK_FAIL_TIERS.includes(option.value)),
        ...options.filter((option) => SKILL_CHECK_PASS_TIERS.includes(option.value)),
        ...options.filter(
            (option) =>
                !SKILL_CHECK_FAIL_TIERS.includes(option.value) &&
                !SKILL_CHECK_PASS_TIERS.includes(option.value),
        ),
    ];
}
