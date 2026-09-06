/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PersonId } from "@/lib/schemas/person";
import { SkillId } from "@/lib/schemas/skill";

import { DEFAULT_SYNTHETIC_CONFIG, generateSyntheticMatrix } from "./synthetic-competency-data";

type MatrixSkill = Parameters<typeof generateSyntheticMatrix>[0][number];

const skills = [
    { id: SkillId.create(), frequency: 12 },
    { id: SkillId.create(), frequency: 24 },
    { id: SkillId.create(), frequency: 6 },
] as unknown as MatrixSkill[];

const personnel = [{ id: PersonId.create() }, { id: PersonId.create() }, { id: PersonId.create() }];

describe("generateSyntheticMatrix", () => {
    it("tags every generated competency with the person it belongs to", () => {
        const config = { ...DEFAULT_SYNTHETIC_CONFIG, coverage: 100 };
        const matrix = generateSyntheticMatrix(skills, personnel, config);

        expect(matrix).toHaveLength(skills.length * personnel.length);
        for (const person of personnel) {
            const forPerson = matrix.filter((c) => c.assesseeId === person.id);
            expect(forPerson.map((c) => c.skillId).sort()).toEqual(skills.map((s) => s.id).sort());
        }
    });

    describe("is deterministic for a given config", () => {
        // The generator reads `new Date()` internally for checkedAt/expiresAt, so without a
        // frozen clock this comparison could flake if the real clock ticks between the two
        // calls below.
        beforeEach(() => {
            vi.useFakeTimers();
            vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it("produces identical output across calls", () => {
            const a = generateSyntheticMatrix(skills, personnel, DEFAULT_SYNTHETIC_CONFIG);
            const b = generateSyntheticMatrix(skills, personnel, DEFAULT_SYNTHETIC_CONFIG);
            expect(a).toEqual(b);
        });
    });

    it("does not produce an identical slice for every person", () => {
        const config = { ...DEFAULT_SYNTHETIC_CONFIG, coverage: 60 };
        const matrix = generateSyntheticMatrix(skills, personnel, config);

        const signature = (personId: string) =>
            matrix
                .filter((c) => c.assesseeId === personId)
                .map((c) => `${c.skillId}:${c.result}`)
                .join("|");

        const signatures = new Set(personnel.map((p) => signature(p.id)));
        expect(signatures.size).toBeGreaterThan(1);
    });

    it("respects the coverage ceiling", () => {
        const none = generateSyntheticMatrix(skills, personnel, {
            ...DEFAULT_SYNTHETIC_CONFIG,
            coverage: 0,
        });
        expect(none).toHaveLength(0);
    });
});
