/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { Maximize2Icon } from "lucide-react";
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
    defaultSkillCheckResultLabel,
    SKILL_CHECK_RESULT_VALUES,
    SkillCheckResultValue,
} from "@/lib/schemas/skill-check";

const FAIL_TIERS: readonly SkillCheckResultValue[] = ["LowFail", "Fail", "HighFail"];
const PASS_TIERS: readonly SkillCheckResultValue[] = ["WeakPass", "Pass", "StrongPass"];

type ResultOption = { value: SkillCheckResultValue; label: string };
type CheckValue = { result: SkillCheckResultValue; notes: string };

export type RecordCheckDensity = "compact" | "expanded";

interface RecordCheckDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Which state the dialog opens in. The body can switch compact → expanded in place. */
    initialDensity: RecordCheckDensity;
    skillName: string;
    personName: string;
    /** The caller's saved check for this assessee and skill, or null if there isn't one. */
    current: CheckValue | null;
    /** The org's enabled results, from `getEnabledSkillCheckResultOptions`. */
    resultOptions: ResultOption[];
    onRecord: (value: CheckValue) => void;
    onDelete: () => void;
}

/**
 * Records one skill check for an (assessee, skill) pair on a session's recording page.
 *
 * - **Compact:** one button per enabled result. A tap records it (keeping any existing notes)
 *   and closes; tapping the current result just closes. **Notes & more** expands in place.
 * - **Expanded:** the same buttons stage a result, with a notes field and Cancel / Delete /
 *   Save. Save is enabled once the staged pair differs from `current`.
 *
 * Controlled and mutation-free: the host owns `open` and supplies `onRecord`/`onDelete` from
 * `useSessionCheckRecorder`. The host should keep its target in place while closing (set `open`
 * false only), so the title and grid don't blank out during the exit animation.
 */
export function SkillTrack_RecordCheckDialog({
    open,
    onOpenChange,
    initialDensity,
    skillName,
    personName,
    current,
    resultOptions,
    onRecord,
    onDelete,
}: RecordCheckDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent mobile="sheet">
                <DialogHeader>
                    <DialogTitle>{skillName}</DialogTitle>
                    <DialogDescription>{personName}</DialogDescription>
                </DialogHeader>
                <RecordCheck_Body
                    // Radix remounts the content on every open; the key also resets the staged
                    // state if the target changes while the dialog stays open.
                    key={`${personName}\u0000${skillName}`}
                    initialDensity={initialDensity}
                    current={current}
                    resultOptions={resultOptions}
                    onRecord={onRecord}
                    onDelete={onDelete}
                    onClose={() => onOpenChange(false)}
                />
            </DialogContent>
        </Dialog>
    );
}

function RecordCheck_Body({
    initialDensity,
    current,
    resultOptions,
    onRecord,
    onDelete,
    onClose,
}: Pick<
    RecordCheckDialogProps,
    "initialDensity" | "current" | "resultOptions" | "onRecord" | "onDelete"
> & { onClose: () => void }) {
    const [density, setDensity] = useState<RecordCheckDensity>(initialDensity);
    const [stagedResult, setStagedResult] = useState<SkillCheckResultValue | null>(
        current?.result ?? null,
    );
    const [stagedNotes, setStagedNotes] = useState(current?.notes ?? "");

    const rows = groupResultOptions(resultOptions, current?.result ?? null);

    function handleResultClick(result: SkillCheckResultValue) {
        if (density === "expanded") {
            setStagedResult(result);
            return;
        }
        if (result !== current?.result) {
            onRecord({ result, notes: current?.notes ?? "" });
        }
        onClose();
    }

    function handleSave() {
        if (stagedResult === null) return;
        onRecord({ result: stagedResult, notes: stagedNotes });
        onClose();
    }

    function handleDelete() {
        onDelete();
        onClose();
    }

    const selected = density === "expanded" ? stagedResult : (current?.result ?? null);
    const changed = stagedResult !== current?.result || stagedNotes !== (current?.notes ?? "");

    return (
        <>
            <DialogBody>
                <div className="flex flex-col gap-2">
                    {rows.map((row, index) => (
                        <div key={index} className="flex flex-wrap gap-2 *:flex-1">
                            {row.map((option) => {
                                const { Icon, className } = RESULT_ICONS[option.value];
                                const isSelected = option.value === selected;
                                return (
                                    <Button
                                        key={option.value}
                                        variant={isSelected ? "outline" : "ghost"}
                                        aria-pressed={isSelected}
                                        onClick={() => handleResultClick(option.value)}
                                    >
                                        <Icon className={className} />
                                        {option.label}
                                    </Button>
                                );
                            })}
                        </div>
                    ))}
                </div>

                {density === "compact" ? (
                    <Button
                        variant="ghost"
                        className="self-start"
                        onClick={() => setDensity("expanded")}
                    >
                        <Maximize2Icon />
                        Notes &amp; more
                    </Button>
                ) : (
                    <Textarea
                        aria-label="Notes"
                        placeholder="Notes..."
                        value={stagedNotes}
                        onChange={(e) => setStagedNotes(e.target.value)}
                    />
                )}
            </DialogBody>

            {density === "expanded" && (
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
            )}
        </>
    );
}

/**
 * The result buttons in up to three rows: fail tiers, pass tiers, then everything else, each
 * in `SKILL_CHECK_RESULT_VALUES` order, with empty rows dropped. The current result is always
 * included, even if the org has since disabled it, so an existing check keeps its active button.
 */
function groupResultOptions(
    resultOptions: ResultOption[],
    currentResult: SkillCheckResultValue | null,
): ResultOption[][] {
    const labels = new Map(resultOptions.map((option) => [option.value, option.label]));
    if (currentResult !== null && !labels.has(currentResult)) {
        labels.set(currentResult, defaultSkillCheckResultLabel(currentResult));
    }

    const options = SKILL_CHECK_RESULT_VALUES.flatMap((value) => {
        const label = labels.get(value);
        return label === undefined ? [] : [{ value, label }];
    });

    return [
        options.filter((option) => FAIL_TIERS.includes(option.value)),
        options.filter((option) => PASS_TIERS.includes(option.value)),
        options.filter(
            (option) => !FAIL_TIERS.includes(option.value) && !PASS_TIERS.includes(option.value),
        ),
    ].filter((row) => row.length > 0);
}
