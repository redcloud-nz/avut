/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { SKILL_TRACK_CONFIGURABLE_RESULT_VALUES } from "@/lib/schemas/organization-settings";
import {
    SKILL_CHECK_FAIL_TIERS,
    SKILL_CHECK_PASS_TIERS,
    SkillCheckResultValue,
} from "@/lib/schemas/skill-check-result";

const CONFIGURABLE = new Set<SkillCheckResultValue>(SKILL_TRACK_CONFIGURABLE_RESULT_VALUES);

/**
 * The configurable skill check results, grouped as the Skill Track settings card and its edit
 * dialog show them: the fail and pass tiers, then anything else offered (today just Not Taught).
 * Built from the configurable list, so a result that becomes configurable later lands in the
 * right group without touching this.
 */
export const SKILL_TRACK_RESULT_GROUPS: readonly {
    label: string;
    values: readonly SkillCheckResultValue[];
}[] = [
    { label: "Fail Tiers", values: SKILL_CHECK_FAIL_TIERS },
    { label: "Pass Tiers", values: SKILL_CHECK_PASS_TIERS },
    {
        label: "Other",
        values: SKILL_TRACK_CONFIGURABLE_RESULT_VALUES.filter(
            (value) =>
                !SKILL_CHECK_FAIL_TIERS.includes(value) && !SKILL_CHECK_PASS_TIERS.includes(value),
        ),
    },
].map((group) => ({ ...group, values: group.values.filter((value) => CONFIGURABLE.has(value)) }));
