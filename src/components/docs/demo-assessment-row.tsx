/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useState } from "react";

import { SkillTrack_AssessmentRow } from "@/components/skill-track/assessment-row";
import { Badge } from "@/components/ui/badge";
import {
    DEFAULT_SKILL_CHECK_RESULT_LABELS,
    SkillCheckResultValue,
} from "@/lib/schemas/skill-check";

// All seven of today's configurable results, so the fail/pass cycle buttons have
// something to cycle through — a real organization may have fewer enabled.
const DEMO_RESULT_OPTIONS: { value: SkillCheckResultValue; label: string }[] = (
    ["NotTaught", "LowFail", "Fail", "HighFail", "WeakPass", "Pass", "StrongPass"] as const
).map((value) => ({ value, label: DEFAULT_SKILL_CHECK_RESULT_LABELS[value] }));

/**
 * Live, interactive example of the assessment row used when recording skill checks —
 * the same component the app uses, just holding its own local state for docs purposes.
 */
export function DocsAssessmentRowDemo() {
    const [value, setValue] = useState<{ result: SkillCheckResultValue | null; notes: string }>({
        result: "Pass",
        notes: "",
    });

    return (
        <div className="my-6 rounded-lg border">
            <div className="text-sm font-medium text-muted-foreground p-2 border-b bg-muted">
                Interactive example
            </div>
            <div className="p-4">
                <SkillTrack_AssessmentRow
                    title="CPR"
                    description="Chest compressions, rescue breaths, and AED use on an adult manikin."
                    value={value}
                    onValueChange={setValue}
                    resultOptions={DEMO_RESULT_OPTIONS}
                />
            </div>
        </div>
    );
}
