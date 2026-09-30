/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { OrganizationId } from "@/lib/schemas/organization";
import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";
import { SkillCheckId, type SessionCheck, type SkillCheck } from "@/lib/schemas/skill-check";
import { SkillCheckSessionId } from "@/lib/schemas/skill-check-session";

import {
    maxCursor,
    mergeSessionChecks,
    otherAssessorChecks,
    patchOwnChecks,
    sessionCheckKey,
} from "./session-checks-sync";

const T = {
    org: OrganizationId.create(),
    session: SkillCheckSessionId.create(),
    self: PersonId.create(),
    jane: PersonId.create(),
    bob: PersonId.create(),
    assessee: PersonId.create(),
    assessee2: PersonId.create(),
    skill: SkillId.create(),
};

const T0 = "2026-09-30T00:00:00.000Z";
const T1 = "2026-09-30T00:00:01.000Z";
const T2 = "2026-09-30T00:00:02.000Z";

function sessionCheck(overrides: Partial<SessionCheck> = {}): SessionCheck {
    return {
        id: SkillCheckId.create(),
        organizationId: T.org,
        sessionId: T.session,
        assesseeId: T.assessee,
        assessorId: T.self,
        assessorLabel: null,
        skillId: T.skill,
        result: "Pass",
        notes: "",
        status: "Draft",
        createdAt: T0,
        updatedAt: T1,
        assesseeName: "Alice",
        skillName: "Knots",
        assessorName: "Self",
        ...overrides,
    };
}

function stripNames(check: SessionCheck): SkillCheck {
    const { assesseeName: _a, skillName: _s, assessorName: _n, ...rest } = check;
    return rest;
}

describe("mergeSessionChecks", () => {
    it("adds a row with an unknown id", () => {
        const row = sessionCheck();
        const { checks, applied } = mergeSessionChecks([], [row]);
        expect(checks).toEqual([row]);
        expect(applied).toEqual([row]);
    });

    it("ignores an older row", () => {
        const cached = sessionCheck({ updatedAt: T2, result: "Fail" });
        const older = { ...cached, updatedAt: T1, result: "Pass" as const };
        const input = [cached];
        const { checks, applied } = mergeSessionChecks(input, [older]);
        expect(checks).toBe(input);
        expect(applied).toEqual([]);
    });

    it("applies a newer row", () => {
        const cached = sessionCheck({ updatedAt: T1 });
        const newer = { ...cached, updatedAt: T2, result: "Fail" as const };
        const { checks, applied } = mergeSessionChecks([cached], [newer]);
        expect(checks).toEqual([newer]);
        expect(applied).toEqual([newer]);
    });

    it("applies an equal-stamp row, filling in the names", () => {
        const local = sessionCheck({ assesseeName: "", skillName: "", assessorName: "" });
        const polled = {
            ...local,
            assesseeName: "Alice",
            skillName: "Knots",
            assessorName: "Self",
        };
        const { checks, applied } = mergeSessionChecks([local], [polled]);
        expect(checks).toEqual([polled]);
        expect(applied).toEqual([polled]);
    });

    it("returns the same array when the incoming rows are identical to the cached ones", () => {
        const row = sessionCheck();
        const input = [row];
        const { checks, applied } = mergeSessionChecks(input, [{ ...row }]);
        expect(checks).toBe(input);
        expect(applied).toEqual([]);
    });

    it("keeps a tombstone that blocks a stale live row", () => {
        const live = sessionCheck({ updatedAt: T1 });
        const tombstone = { ...live, status: "Deleted" as const, updatedAt: T2 };
        const afterDelete = mergeSessionChecks([live], [tombstone]).checks;
        expect(afterDelete).toEqual([tombstone]);

        const { checks, applied } = mergeSessionChecks(afterDelete, [live]);
        expect(checks).toBe(afterDelete);
        expect(applied).toEqual([]);
    });

    it("leaves untouched rows in place", () => {
        const a = sessionCheck({ assessorId: T.jane });
        const b = sessionCheck({ assessorId: T.bob });
        const newerB = { ...b, updatedAt: T2 };
        const { checks } = mergeSessionChecks([a, b], [newerB]);
        expect(checks[0]).toBe(a);
        expect(checks[1]).toBe(newerB);
    });
});

describe("patchOwnChecks", () => {
    it("leaves an uncached list undefined", () => {
        expect(patchOwnChecks(undefined, [sessionCheck()], T.self)).toBeUndefined();
    });

    it("ignores other assessors' rows", () => {
        const own: SkillCheck[] = [];
        const result = patchOwnChecks(own, [sessionCheck({ assessorId: T.jane })], T.self);
        expect(result).toBe(own);
    });

    it("adds a live own row, stripped to the SkillCheck shape", () => {
        const row = sessionCheck();
        const result = patchOwnChecks([], [row], T.self);
        expect(result).toEqual([stripNames(row)]);
        expect(result?.[0]).not.toHaveProperty("assesseeName");
    });

    it("replaces the own row with a newer or equal live row", () => {
        const row = sessionCheck({ updatedAt: T1 });
        const own = [stripNames(row)];
        const newer = { ...row, updatedAt: T2, result: "Fail" as const };
        expect(patchOwnChecks(own, [newer], T.self)).toEqual([stripNames(newer)]);

        const equal = { ...row, notes: "same stamp" };
        expect(patchOwnChecks(own, [equal], T.self)).toEqual([stripNames(equal)]);
    });

    it("ignores an older live row", () => {
        const current = stripNames(sessionCheck({ updatedAt: T2 }));
        const own = [current];
        const older = sessionCheck({ id: current.id, updatedAt: T1, result: "Fail" });
        expect(patchOwnChecks(own, [older], T.self)).toBe(own);
    });

    it("removes the own row for a newer or equal tombstone", () => {
        const row = sessionCheck({ updatedAt: T1 });
        const other = stripNames(sessionCheck({ assesseeId: T.assessee2 }));
        const own = [stripNames(row), other];

        const newer = { ...row, status: "Deleted" as const, updatedAt: T2 };
        expect(patchOwnChecks(own, [newer], T.self)).toEqual([other]);

        const equal = { ...row, status: "Deleted" as const };
        expect(patchOwnChecks(own, [equal], T.self)).toEqual([other]);
    });

    it("ignores an older tombstone", () => {
        const current = stripNames(sessionCheck({ updatedAt: T2 }));
        const own = [current];
        const tombstone = sessionCheck({ id: current.id, updatedAt: T1, status: "Deleted" });
        expect(patchOwnChecks(own, [tombstone], T.self)).toBe(own);
    });

    it("returns the same array for a tombstone with no own row", () => {
        const own: SkillCheck[] = [];
        expect(patchOwnChecks(own, [sessionCheck({ status: "Deleted" })], T.self)).toBe(own);
    });
});

describe("maxCursor", () => {
    it("keeps the later cursor", () => {
        expect(maxCursor(T1, T2)).toBe(T2);
        expect(maxCursor(T2, T1)).toBe(T2);
    });

    it("takes the new cursor when there is no old one", () => {
        expect(maxCursor(undefined, T1)).toBe(T1);
    });
});

describe("otherAssessorChecks", () => {
    it("groups other assessors' live checks by pair, sorted by assessor name", () => {
        const jane = sessionCheck({ assessorId: T.jane, assessorName: "Jane" });
        const bob = sessionCheck({
            assessorId: T.bob,
            assessorName: "Bob",
            result: "Fail",
        });
        const map = otherAssessorChecks([jane, bob], T.self);
        expect(map.get(sessionCheckKey(T.assessee, T.skill))).toEqual([
            { assessorName: "Bob", result: "Fail" },
            { assessorName: "Jane", result: "Pass" },
        ]);
    });

    it("drops tombstones, the caller's rows and rows without names", () => {
        const map = otherAssessorChecks(
            [
                sessionCheck({ assessorId: T.jane, assessorName: "Jane", status: "Deleted" }),
                sessionCheck({ assessorId: T.self }),
                sessionCheck({
                    assessorId: T.bob,
                    assesseeName: "",
                    skillName: "",
                    assessorName: "",
                }),
            ],
            T.self,
        );
        expect(map.size).toBe(0);
    });

    it("includes a purged assessor's check", () => {
        const purged = sessionCheck({
            assessorId: null,
            assessorLabel: "Gone",
            assessorName: "Gone",
        });
        const map = otherAssessorChecks([purged], T.self);
        expect(map.get(sessionCheckKey(T.assessee, T.skill))).toEqual([
            { assessorName: "Gone", result: "Pass" },
        ]);
    });
});
