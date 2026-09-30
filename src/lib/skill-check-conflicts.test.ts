/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import {
    findConflicts,
    groupChecksByPair,
    initialSelection,
    pairKey,
    reconcileSelection,
    type ConflictCheckFields,
} from "./skill-check-conflicts";

type Status = ConflictCheckFields["status"];

interface TestCheck {
    id: string;
    assesseeId: string;
    skillId: string;
    assessorId: string | null;
    status: Status;
}

function check(
    id: string,
    assesseeId: string,
    skillId: string,
    assessorId: string | null,
    status: Status = "Draft",
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

interface SelectionTestCheck {
    id: string;
    assesseeId: string;
    skillId: string;
    status: Status;
    updatedAt: string;
}

const T0 = "2026-09-30T10:00:00.000Z";
const T1 = "2026-09-30T11:00:00.000Z";

function sc(
    id: string,
    assesseeId: string,
    skillId: string,
    status: Status,
    updatedAt = T0,
): SelectionTestCheck {
    return { id, assesseeId, skillId, status, updatedAt };
}

function ids(set: Set<string>): string[] {
    return [...set].sort();
}

describe("initialSelection", () => {
    describe("checks outside a conflict group", () => {
        it("ticks Draft, Pending and Include checks", () => {
            const checks = [
                sc("c1", "p1", "s1", "Draft"),
                sc("c2", "p1", "s2", "Pending"),
                sc("c3", "p2", "s1", "Include"),
            ];

            expect(ids(initialSelection(checks))).toEqual(["c1", "c2", "c3"]);
        });

        it("leaves an Exclude check unticked", () => {
            const checks = [sc("c1", "p1", "s1", "Exclude"), sc("c2", "p1", "s2", "Draft")];

            expect(ids(initialSelection(checks))).toEqual(["c2"]);
        });

        it("never selects a Deleted check", () => {
            expect(ids(initialSelection([sc("c1", "p1", "s1", "Deleted")]))).toEqual([]);
        });
    });

    describe("conflict groups", () => {
        it("picks nothing when the group has no Pending check", () => {
            const checks = [
                sc("c1", "p1", "s1", "Draft"),
                sc("c2", "p1", "s1", "Include"),
                sc("c3", "p1", "s1", "Exclude"),
            ];

            expect(ids(initialSelection(checks))).toEqual([]);
        });

        it("picks the Pending check when there's exactly one and no Draft", () => {
            const checks = [
                sc("c1", "p1", "s1", "Pending"),
                sc("c2", "p1", "s1", "Exclude"),
                sc("c3", "p2", "s1", "Draft"),
            ];

            expect(ids(initialSelection(checks))).toEqual(["c1", "c3"]);
        });

        it("picks nothing when the group has two Pending checks", () => {
            const checks = [sc("c1", "p1", "s1", "Pending"), sc("c2", "p1", "s1", "Pending")];

            expect(ids(initialSelection(checks))).toEqual([]);
        });

        it("picks nothing when the group has one Pending and one Draft", () => {
            const checks = [sc("c1", "p1", "s1", "Pending"), sc("c2", "p1", "s1", "Draft")];

            expect(ids(initialSelection(checks))).toEqual([]);
        });
    });
});

describe("reconcileSelection", () => {
    it("clears a group's pick when a third assessor's check joins it", () => {
        const prev = [sc("c1", "p1", "s1", "Draft"), sc("c2", "p1", "s1", "Draft")];
        const next = [...prev, sc("c3", "p1", "s1", "Draft")];

        expect(ids(reconcileSelection(prev, next, new Set(["c1"])))).toEqual([]);
    });

    it("clears a group's pick when an existing member is re-recorded", () => {
        const prev = [sc("c1", "p1", "s1", "Pending"), sc("c2", "p1", "s1", "Exclude")];
        const next = [sc("c1", "p1", "s1", "Pending"), sc("c2", "p1", "s1", "Draft", T1)];

        expect(ids(reconcileSelection(prev, next, new Set(["c1"])))).toEqual([]);
    });

    it("re-picks the lone Pending check when a reopen changes the group", () => {
        const prev = [sc("c1", "p1", "s1", "Include"), sc("c2", "p1", "s1", "Exclude")];
        const next = [sc("c1", "p1", "s1", "Pending", T1), sc("c2", "p1", "s1", "Exclude")];

        expect(ids(reconcileSelection(prev, next, new Set<string>()))).toEqual(["c1"]);
    });

    it("picks the Pending check when a lone Pending check gains an Exclude member", () => {
        const prev = [sc("c1", "p1", "s1", "Pending")];
        const next = [sc("c1", "p1", "s1", "Pending"), sc("c2", "p1", "s1", "Exclude")];

        expect(ids(reconcileSelection(prev, next, new Set<string>()))).toEqual(["c1"]);
    });

    it("keeps the user's pick in an unchanged group", () => {
        const prev = [
            sc("c1", "p1", "s1", "Draft"),
            sc("c2", "p1", "s1", "Draft"),
            sc("c3", "p2", "s1", "Draft"),
        ];
        // A fresh array, as a refetch returns, with the group's rows unchanged and another row changed.
        const next = [
            sc("c1", "p1", "s1", "Draft"),
            sc("c2", "p1", "s1", "Draft"),
            sc("c3", "p2", "s1", "Draft", T1),
        ];

        expect(ids(reconcileSelection(prev, next, new Set(["c2", "c3"])))).toEqual(["c2", "c3"]);
    });

    it("leaves nothing picked when a ticked check becomes part of a group", () => {
        const prev = [sc("c1", "p1", "s1", "Draft")];
        const next = [sc("c1", "p1", "s1", "Draft"), sc("c2", "p1", "s1", "Draft")];

        expect(ids(reconcileSelection(prev, next, new Set(["c1"])))).toEqual([]);
    });

    it("ticks the check left when a group shrinks to one, unless it's Exclude", () => {
        const prev = [
            sc("c1", "p1", "s1", "Draft"),
            sc("c2", "p1", "s1", "Draft"),
            sc("c3", "p2", "s1", "Exclude"),
            sc("c4", "p2", "s1", "Draft"),
        ];
        const next = [
            sc("c1", "p1", "s1", "Draft"),
            sc("c2", "p1", "s1", "Deleted", T1),
            sc("c3", "p2", "s1", "Exclude"),
        ];

        expect(ids(reconcileSelection(prev, next, new Set(["c2", "c4"])))).toEqual(["c1"]);
    });

    it("keeps a check the user unticked unticked across a refetch that changes other rows", () => {
        const prev = [sc("c1", "p1", "s1", "Draft"), sc("c2", "p1", "s2", "Draft")];
        const next = [sc("c1", "p1", "s1", "Draft"), sc("c2", "p1", "s2", "Draft", T1)];

        expect(ids(reconcileSelection(prev, next, new Set(["c2"])))).toEqual(["c2"]);
    });

    it("ticks a new check outside any group", () => {
        const prev = [sc("c1", "p1", "s1", "Draft")];
        const next = [...prev, sc("c2", "p1", "s2", "Draft")];

        expect(ids(reconcileSelection(prev, next, new Set<string>()))).toEqual(["c2"]);
    });
});
