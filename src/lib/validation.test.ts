/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, it, expect } from "vitest";

import { propertiesSchema, tagsSchema } from "./validation";

describe("propertiesSchema", () => {
    it("accepts a flat record of scalars", () => {
        const value = {
            d4hTeamId: 12,
            d4hLastSync: "2026-01-01T00:00:00.000Z",
            ok: true,
            none: null,
        };
        expect(propertiesSchema.parse(value)).toEqual(value);
    });

    it("accepts an empty record", () => {
        expect(propertiesSchema.parse({})).toEqual({});
    });

    it("rejects a nested object", () => {
        expect(propertiesSchema.safeParse({ nested: { a: 1 } }).success).toBe(false);
    });

    it("rejects an array value", () => {
        expect(propertiesSchema.safeParse({ list: ["a"] }).success).toBe(false);
    });
});

describe("tagsSchema", () => {
    it("accepts unique non-empty tags", () => {
        expect(tagsSchema.parse(["red", "blue"])).toEqual(["red", "blue"]);
    });

    it("accepts an empty list", () => {
        expect(tagsSchema.parse([])).toEqual([]);
    });

    it("rejects duplicates", () => {
        expect(tagsSchema.safeParse(["red", "red"]).success).toBe(false);
    });

    it("rejects an empty tag", () => {
        expect(tagsSchema.safeParse([""]).success).toBe(false);
    });
});
