/*
 *  Copyright (c) 2026 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import * as z from "zod";

export const SKILL_CHECK_RESULT_VALUES = [
    "NotTaught",
    "LowFail",
    "Fail",
    "HighFail",
    "WeakPass",
    "Pass",
    "StrongPass",
    "Exempt",
    "Expired",
    "Provisional",
] as const;

export const SkillCheckResultValue = {
    schema: z.enum(SKILL_CHECK_RESULT_VALUES),
} as const;

export type SkillCheckResultValue = z.infer<typeof SkillCheckResultValue.schema>;

/**
 * Converts a result value's identifier into a readable default label, e.g. "WeakPass" -> "Weak Pass".
 * Used to seed per-organization label defaults and as a fallback when an org's config is missing one.
 */
export function defaultSkillCheckResultLabel(value: SkillCheckResultValue): string {
    return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export const DEFAULT_SKILL_CHECK_RESULT_LABELS: Record<SkillCheckResultValue, string> =
    Object.fromEntries(
        SKILL_CHECK_RESULT_VALUES.map((value) => [value, defaultSkillCheckResultLabel(value)]),
    ) as Record<SkillCheckResultValue, string>;

/**
 * The results that demonstrate competency. Any other result — including "Fail" and
 * "NotTaught" — means the person is not competent in that skill.
 */
export const COMPETENT_SKILL_CHECK_RESULTS: readonly SkillCheckResultValue[] = [
    "WeakPass",
    "Pass",
    "StrongPass",
];

/**
 * Whether a skill check result demonstrates competency in the skill.
 * @param result The result of the skill check.
 */
export function isCompetentResult(result: SkillCheckResultValue): boolean {
    return COMPETENT_SKILL_CHECK_RESULTS.includes(result);
}
