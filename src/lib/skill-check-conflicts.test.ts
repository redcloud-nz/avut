/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { findConflicts, groupChecksByPair, pairKey } from "./skill-check-conflicts";

interface TestCheck {
    id: string;
    assesseeId: string;
    skillId: string;
    assessorId: string | null;
    status: string;
}

function check(
    id: string,
    assesseeId: string,
    skillId: string,
    assessorId: string | null,
    status = "Draft",
): TestCheck {
    return { id, assesseeId, skillId, assessorId, status };
}

describe("pairKey", () => {
    it("joins the assessee and skill ids", () => {
        expect(pairKey("p1", "s1")).toBe("p1:s1");
    });
});

describe("groupChecksByPair", () => {
    it("groups live checks by pair, keeping insertion order", () => {
        const checks = [
            check("c1", "p1", "s1", "a1"),
            check("c2", "p2", "s1", "a1"),
            check("c3", "p1", "s1", "a2"),
            check("c4", "p1", "s2", "a1", "Deleted"),
        ];

        const groups = groupChecksByPair(checks);

        expect([...groups.keys()]).toEqual(["p1:s1", "p2:s1"]);
        expect(groups.get("p1:s1")?.map((c) => c.id)).toEqual(["c1", "c3"]);
        expect(groups.get("p2:s1")?.map((c) => c.id)).toEqual(["c2"]);
    });
});

describe("findConflicts", () => {
    it("returns nothing when every pair has one check", () => {
        const checks = [
            check("c1", "p1", "s1", "a1"),
            check("c2", "p1", "s2", "a1"),
            check("c3", "p2", "s1", "a2"),
        ];

        expect(findConflicts(checks)).toEqual([]);
    });

    it("finds two assessors on one pair", () => {
        const c1 = check("c1", "p1", "s1", "a1");
        const c2 = check("c2", "p1", "s1", "a2", "Pending");
        const other = check("c3", "p2", "s1", "a1");

        expect(findConflicts([c1, other, c2])).toEqual([
            { key: "p1:s1", assesseeId: "p1", skillId: "s1", checks: [c1, c2] },
        ]);
    });

    it("finds three assessors on one pair", () => {
        const checks = [
            check("c1", "p1", "s1", "a1"),
            check("c2", "p1", "s1", "a2"),
            check("c3", "p1", "s1", "a3"),
        ];

        const conflicts = findConflicts(checks);

        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].checks.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
    });

    it("ignores a Deleted check, so it doesn't make a conflict", () => {
        const checks = [check("c1", "p1", "s1", "a1"), check("c2", "p1", "s1", "a2", "Deleted")];

        expect(findConflicts(checks)).toEqual([]);
    });

    it("counts two checks with purged assessors (assessorId null) as a conflict", () => {
        const checks = [
            check("c1", "p1", "s1", null, "Include"),
            check("c2", "p1", "s1", null, "Include"),
        ];

        const conflicts = findConflicts(checks);

        expect(conflicts).toHaveLength(1);
        expect(conflicts[0].checks.map((c) => c.id)).toEqual(["c1", "c2"]);
    });

    it("doesn't group checks on different pairs together", () => {
        const checks = [
            check("c1", "p1", "s1", "a1"),
            check("c2", "p1", "s2", "a2"),
            check("c3", "p2", "s1", "a2"),
            check("c4", "p2", "s2", "a1"),
        ];

        expect(findConflicts(checks)).toEqual([]);
    });

    it("returns each conflicting pair separately, in order of first appearance", () => {
        const checks = [
            check("c1", "p2", "s1", "a1"),
            check("c2", "p1", "s1", "a1"),
            check("c3", "p1", "s1", "a2"),
            check("c4", "p2", "s1", "a2"),
        ];

        expect(findConflicts(checks).map((c) => c.key)).toEqual(["p2:s1", "p1:s1"]);
    });
});
