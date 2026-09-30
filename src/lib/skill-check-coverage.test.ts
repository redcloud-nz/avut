/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { findNotAssessed, type CoverageCheckFields } from "./skill-check-coverage";

function check(assesseeId: string, skillId: string, status = "Draft"): CoverageCheckFields {
    return { assesseeId, skillId, status };
}

describe("findNotAssessed", () => {
    it("lists every assessee with every skill when there are no checks", () => {
        expect(findNotAssessed(["p1", "p2"], ["s1", "s2"], [])).toEqual([
            { assesseeId: "p1", skillIds: ["s1", "s2"] },
            { assesseeId: "p2", skillIds: ["s1", "s2"] },
        ]);
    });

    it("returns nothing when every pair has a check", () => {
        const checks = [
            check("p1", "s1"),
            check("p1", "s2", "Include"),
            check("p2", "s1", "Exclude"),
            check("p2", "s2"),
        ];

        expect(findNotAssessed(["p1", "p2"], ["s1", "s2"], checks)).toEqual([]);
    });

    it("counts a pair covered only by a Deleted check as not assessed", () => {
        const checks = [check("p1", "s1", "Deleted"), check("p1", "s2")];

        expect(findNotAssessed(["p1"], ["s1", "s2"], checks)).toEqual([
            { assesseeId: "p1", skillIds: ["s1"] },
        ]);
    });

    it("ignores checks for assessees or skills not in the lists", () => {
        const checks = [check("p1", "s1"), check("p9", "s2"), check("p1", "s9")];

        expect(findNotAssessed(["p1"], ["s1", "s2"], checks)).toEqual([
            { assesseeId: "p1", skillIds: ["s2"] },
        ]);
    });

    it("follows the order of the input lists", () => {
        expect(findNotAssessed(["p2", "p1"], ["s3", "s1", "s2"], [check("p1", "s1")])).toEqual([
            { assesseeId: "p2", skillIds: ["s3", "s1", "s2"] },
            { assesseeId: "p1", skillIds: ["s3", "s2"] },
        ]);
    });

    it("leaves out an assessee with no gaps", () => {
        const checks = [check("p1", "s1"), check("p1", "s2"), check("p2", "s1")];

        expect(findNotAssessed(["p1", "p2", "p3"], ["s1", "s2"], checks)).toEqual([
            { assesseeId: "p2", skillIds: ["s2"] },
            { assesseeId: "p3", skillIds: ["s1", "s2"] },
        ]);
    });
});
