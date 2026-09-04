/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_SYNTHETIC_CONFIG, generateSyntheticMatrix } from "./synthetic-competency-data";

type MatrixSkill = Parameters<typeof generateSyntheticMatrix>[0][number];

const skills = [
    { id: "skill-1", frequency: 12 },
    { id: "skill-2", frequency: 24 },
    { id: "skill-3", frequency: 6 },
] as unknown as MatrixSkill[];

const personnel = [{ id: "person-a" }, { id: "person-b" }, { id: "person-c" }] as Parameters<
    typeof generateSyntheticMatrix
>[1];

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

    it("is deterministic for a given config", () => {
        const a = generateSyntheticMatrix(skills, personnel, DEFAULT_SYNTHETIC_CONFIG);
        const b = generateSyntheticMatrix(skills, personnel, DEFAULT_SYNTHETIC_CONFIG);
        expect(a).toEqual(b);
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
