/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { coverageBy, type CoverageCheckFields } from "./skill-check-coverage";

function check(assesseeId: string, skillId: string, status = "Draft"): CoverageCheckFields {
    return { assesseeId, skillId, status };
}

describe("coverageBy", () => {
    it("lists every id, with no checks and nothing covered, when there are no checks", () => {
        expect(coverageBy("assessee", ["p1", "p2"], ["s1", "s2"], [])).toEqual([
            { id: "p1", checks: [], covered: 0, total: 2 },
            { id: "p2", checks: [], covered: 0, total: 2 },
        ]);
    });

    it("groups checks by assessee and counts the distinct skills covered", () => {
        const a = check("p1", "s1");
        const b = check("p1", "s1", "Include"); // a second assessor on the same skill
        const c = check("p1", "s2");
        const d = check("p2", "s2");

        expect(coverageBy("assessee", ["p1", "p2"], ["s1", "s2", "s3"], [a, b, c, d])).toEqual([
            { id: "p1", checks: [a, b, c], covered: 2, total: 3 },
            { id: "p2", checks: [d], covered: 1, total: 3 },
        ]);
    });

    it("groups checks by skill and counts the distinct assessees covered", () => {
        const a = check("p1", "s1");
        const b = check("p2", "s1");

        expect(coverageBy("skill", ["s1", "s2"], ["p1", "p2"], [a, b])).toEqual([
            { id: "s1", checks: [a, b], covered: 2, total: 2 },
            { id: "s2", checks: [], covered: 0, total: 2 },
        ]);
    });

    it("ignores Deleted checks", () => {
        expect(coverageBy("assessee", ["p1"], ["s1"], [check("p1", "s1", "Deleted")])).toEqual([
            { id: "p1", checks: [], covered: 0, total: 1 },
        ]);
    });

    it("keeps checks on unassigned skills but doesn't count them as coverage", () => {
        const retired = check("p1", "retired");

        expect(coverageBy("assessee", ["p1"], ["s1"], [retired])).toEqual([
            { id: "p1", checks: [retired], covered: 0, total: 1 },
        ]);
    });

    it("keeps the order of the ids", () => {
        expect(coverageBy("skill", ["s2", "s1"], [], []).map((c) => c.id)).toEqual(["s2", "s1"]);
    });
});
