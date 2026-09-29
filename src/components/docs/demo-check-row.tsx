/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";

import { SkillTrack_CheckRow } from "@/components/skill-track/check-row";
import { SkillTrack_RecordCheckDialog } from "@/components/skill-track/record-check-dialog";
import {
    DEFAULT_SKILL_CHECK_RESULT_LABELS,
    type SkillCheckResultOption,
    type SkillCheckResultValue,
} from "@/lib/schemas/skill-check";

// All seven of today's configurable results, so the dialog has a full set to choose from — a
// real organization may have fewer enabled.
const DEMO_RESULT_OPTIONS: SkillCheckResultOption[] = (
    ["NotTaught", "LowFail", "Fail", "HighFail", "WeakPass", "Pass", "StrongPass"] as const
).map((value) => ({ value, label: DEFAULT_SKILL_CHECK_RESULT_LABELS[value] }));

const demoResultLabel = (value: SkillCheckResultValue) => DEFAULT_SKILL_CHECK_RESULT_LABELS[value];

const SKILL_NAME = "CPR";
const SKILL_DESCRIPTION = "Chest compressions, rescue breaths, and AED use on an adult manikin.";

/**
 * Live, interactive example of the row used when recording skill checks, with its `More` dialog —
 * the same components the app uses, just holding their own local state for docs purposes.
 */
export function DocsCheckRowDemo() {
    const [check, setCheck] = useState<{ result: SkillCheckResultValue; notes: string } | null>({
        result: "Pass",
        notes: "",
    });
    const [dialogOpen, setDialogOpen] = useState(false);

    return (
        <div className="my-6 rounded-lg border">
            <div className="text-sm font-medium text-muted-foreground p-2 border-b bg-muted">
                Interactive example
            </div>
            <div className="p-4">
                <SkillTrack_CheckRow
                    title={SKILL_NAME}
                    description={SKILL_DESCRIPTION}
                    check={check}
                    pending={undefined}
                    resultOptions={DEMO_RESULT_OPTIONS}
                    resultLabel={demoResultLabel}
                    onRecord={setCheck}
                    onRemove={() => setCheck(null)}
                    onOpenDialog={() => setDialogOpen(true)}
                />
            </div>
            <SkillTrack_RecordCheckDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                targetKey="demo"
                skillName={SKILL_NAME}
                personName="Alex Example"
                current={check}
                resultOptions={DEMO_RESULT_OPTIONS}
                resultLabel={demoResultLabel}
                onRecord={setCheck}
                onDelete={() => setCheck(null)}
            />
        </div>
    );
}
