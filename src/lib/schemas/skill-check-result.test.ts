/*
 *  Copyright (c) 2026 Redcloud Development, Ltd.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import {
    COMPETENT_SKILL_CHECK_RESULTS,
    defaultSkillCheckResultLabel,
    isCompetentResult,
    SKILL_CHECK_RESULT_VALUES,
} from "./skill-check-result";

describe("defaultSkillCheckResultLabel", () => {
    it("inserts a space between a lowercase/uppercase boundary", () => {
        expect(defaultSkillCheckResultLabel("WeakPass")).toBe("Weak Pass");
        expect(defaultSkillCheckResultLabel("HighFail")).toBe("High Fail");
        expect(defaultSkillCheckResultLabel("NotTaught")).toBe("Not Taught");
    });

    it("leaves single-word values unchanged", () => {
        expect(defaultSkillCheckResultLabel("Fail")).toBe("Fail");
        expect(defaultSkillCheckResultLabel("Pass")).toBe("Pass");
        expect(defaultSkillCheckResultLabel("Exempt")).toBe("Exempt");
    });
});

describe("isCompetentResult", () => {
    it("is true for exactly the pass tiers", () => {
        expect(COMPETENT_SKILL_CHECK_RESULTS).toEqual(["WeakPass", "Pass", "StrongPass"]);

        for (const value of SKILL_CHECK_RESULT_VALUES) {
            expect(isCompetentResult(value)).toBe(
                value === "WeakPass" || value === "Pass" || value === "StrongPass",
            );
        }
    });
});
