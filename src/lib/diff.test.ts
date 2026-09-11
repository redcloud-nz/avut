/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, it, expect } from "vitest";
import * as z from "zod";
import { diffObject, DiffChange, DiffValueError } from "./diff";

describe("diff", () => {
    it("should return empty array for identical objects", () => {
        const a = { name: "John", age: 30 };
        const b = { name: "John", age: 30 };

        const result = diffObject(a, b);
        expect(result).toEqual([]);
    });

    it("should detect object key additions", () => {
        const a = { name: "John" };
        const b = { name: "John", age: 30 };

        const result = diffObject(a, b);
        expect(result).toEqual([{ path: ["age"], type: "obj_add", curr: 30 }]);
    });

    it("should detect object key removals", () => {
        const a = { name: "John", age: 30 };
        const b = { name: "John" };

        const result = diffObject(a, b);
        expect(result).toEqual([{ path: ["age"], type: "obj_del", prev: 30 }]);
    });

    it("should detect object key modifications", () => {
        const a = { name: "John", age: 30 };
        const b = { name: "John", age: 31 };

        const result = diffObject(a, b);
        expect(result).toEqual([{ path: ["age"], type: "obj_mod", prev: 30, curr: 31 }]);
    });

    it("should detect array additions", () => {
        const a = { tags: ["red", "blue"] };
        const b = { tags: ["red", "blue", "green"] };

        const result = diffObject(a, b);
        expect(result).toEqual([{ path: ["tags"], type: "arr_add", value: "green" }]);
    });

    it("should detect array removals", () => {
        const a = { tags: ["red", "blue", "green"] };
        const b = { tags: ["red", "blue"] };

        const result = diffObject(a, b);
        expect(result).toEqual([{ path: ["tags"], type: "arr_del", value: "green" }]);
    });

    it("should detect multiple array changes", () => {
        const a = { tags: ["red", "blue"] };
        const b = { tags: ["blue", "green"] };

        const result = diffObject(a, b);
        expect(result).toHaveLength(2);
        expect(result).toContainEqual({
            path: ["tags"],
            type: "arr_del",
            value: "red",
        });
        expect(result).toContainEqual({
            path: ["tags"],
            type: "arr_add",
            value: "green",
        });
    });

    it("should handle nested objects", () => {
        const a = { user: { name: "John", age: 30 } };
        const b = { user: { name: "Jane", age: 30 } };

        const result = diffObject(a, b);
        expect(result).toEqual([
            {
                path: ["user", "name"],
                type: "obj_mod",
                prev: "John",
                curr: "Jane",
            },
        ]);
    });

    it("should handle deeply nested objects", () => {
        const a = { user: { profile: { name: "John" } } };
        const b = {
            user: { profile: { name: "Jane", email: "jane@example.com" } },
        };

        const result = diffObject(a, b);
        expect(result).toHaveLength(2);
        expect(result).toContainEqual({
            path: ["user", "profile", "name"],
            type: "obj_mod",
            prev: "John",
            curr: "Jane",
        });
        expect(result).toContainEqual({
            path: ["user", "profile", "email"],
            type: "obj_add",
            curr: "jane@example.com",
        });
    });

    it("should handle arrays with numbers", () => {
        const a = { scores: [1, 2, 3] };
        const b = { scores: [2, 3, 4] };

        const result = diffObject(a, b);
        expect(result).toHaveLength(2);
        expect(result).toContainEqual({
            path: ["scores"],
            type: "arr_del",
            value: 1,
        });
        expect(result).toContainEqual({
            path: ["scores"],
            type: "arr_add",
            value: 4,
        });
    });

    it("treats undefined as absent, not as a value", () => {
        const a = { value: null, missing: undefined };
        const b = { value: "hello", extra: null };

        const result = diffObject(a, b);
        expect(result).toHaveLength(2);
        expect(result).toContainEqual({
            path: ["value"],
            type: "obj_mod",
            prev: null,
            curr: "hello",
        });
        expect(result).toContainEqual({
            path: ["extra"],
            type: "obj_add",
            curr: null,
        });
    });

    it("should handle boolean values", () => {
        const a = { active: true, hidden: false };
        const b = { active: false, hidden: false };

        const result = diffObject(a, b);
        expect(result).toEqual([{ path: ["active"], type: "obj_mod", prev: true, curr: false }]);
    });

    it("should handle empty objects", () => {
        const a = {};
        const b = { name: "John" };

        const result = diffObject(a, b);
        expect(result).toEqual([{ path: ["name"], type: "obj_add", curr: "John" }]);
    });

    it("should handle empty arrays", () => {
        const a = { tags: [] };
        const b = { tags: ["red"] };

        const result = diffObject(a, b);
        expect(result).toEqual([{ path: ["tags"], type: "arr_add", value: "red" }]);
    });

    it("should handle complex mixed changes", () => {
        const a = {
            name: "John",
            age: 30,
            tags: ["red", "blue"],
            profile: { email: "john@example.com" },
        };
        const b = {
            name: "Jane",
            tags: ["blue", "green"],
            profile: { email: "jane@example.com", verified: true },
            status: "active",
        };

        const result = diffObject(a, b);
        expect(result).toContainEqual({
            path: ["name"],
            type: "obj_mod",
            prev: "John",
            curr: "Jane",
        });
        expect(result).toContainEqual({
            path: ["age"],
            type: "obj_del",
            prev: 30,
        });
        expect(result).toContainEqual({
            path: ["tags"],
            type: "arr_del",
            value: "red",
        });
        expect(result).toContainEqual({
            path: ["tags"],
            type: "arr_add",
            value: "green",
        });
        expect(result).toContainEqual({
            path: ["profile", "email"],
            type: "obj_mod",
            prev: "john@example.com",
            curr: "jane@example.com",
        });
        expect(result).toContainEqual({
            path: ["profile", "verified"],
            type: "obj_add",
            curr: true,
        });
        expect(result).toContainEqual({
            path: ["status"],
            type: "obj_add",
            curr: "active",
        });
    });

    it("converts Date values to ISO strings", () => {
        const a = { at: new Date("2020-01-01T00:00:00.000Z") };
        const b = { at: new Date("2021-01-01T00:00:00.000Z") };

        expect(diffObject(a, b)).toEqual([
            {
                path: ["at"],
                type: "obj_mod",
                prev: "2020-01-01T00:00:00.000Z",
                curr: "2021-01-01T00:00:00.000Z",
            },
        ]);
    });

    it("expands an added nested object into leaves", () => {
        const a = {};
        const b = { d4h: { categoryId: 12, kindTitle: "Helmet", requireSN: true } };

        const result = diffObject(a, b);
        expect(result).toHaveLength(3);
        expect(result).toContainEqual({
            path: ["d4h", "categoryId"],
            type: "obj_add",
            curr: 12,
        });
        expect(result).toContainEqual({
            path: ["d4h", "kindTitle"],
            type: "obj_add",
            curr: "Helmet",
        });
        expect(result).toContainEqual({
            path: ["d4h", "requireSN"],
            type: "obj_add",
            curr: true,
        });
    });

    it("handles null becoming an object", () => {
        const a = { d4h: null };
        const b = { d4h: { categoryId: 12 } };

        const result = diffObject(a, b);
        expect(result).toHaveLength(2);
        expect(result).toContainEqual({ path: ["d4h"], type: "obj_del", prev: null });
        expect(result).toContainEqual({
            path: ["d4h", "categoryId"],
            type: "obj_add",
            curr: 12,
        });
    });

    it("handles an object becoming null", () => {
        const a = { d4h: { categoryId: 12 } };
        const b = { d4h: null };

        const result = diffObject(a, b);
        expect(result).toHaveLength(2);
        expect(result).toContainEqual({
            path: ["d4h", "categoryId"],
            type: "obj_del",
            prev: 12,
        });
        expect(result).toContainEqual({ path: ["d4h"], type: "obj_add", curr: null });
    });

    it("distinguishes an added array field from an added element", () => {
        expect(diffObject({}, { tags: ["red", "blue"] })).toEqual([
            { path: ["tags"], type: "obj_add", curr: ["red", "blue"] },
        ]);

        expect(diffObject({ tags: ["red"] }, { tags: ["red", "blue"] })).toEqual([
            { path: ["tags"], type: "arr_add", value: "blue" },
        ]);
    });

    it("keeps path segments separate when a key contains a dot", () => {
        const a = { properties: { "a.b": 1 } };
        const b = { properties: { "a.b": 2 } };

        expect(diffObject(a, b)).toEqual([
            { path: ["properties", "a.b"], type: "obj_mod", prev: 1, curr: 2 },
        ]);
    });

    it("produces no change for an object with no leaves", () => {
        expect(diffObject({}, { d4h: {} })).toEqual([]);
    });

    it.each([
        ["a Map", { x: new Map() }],
        ["a Set", { x: new Set() }],
        ["a function", { x: () => undefined }],
        ["a bigint", { x: BigInt(1) }],
        ["a class instance", { x: new (class Thing {})() }],
        ["an array of objects", { x: [{ a: 1 }] }],
        ["a nested array", { x: [[1]] }],
        ["NaN", { x: NaN }],
    ])("throws on %s", (_label, input) => {
        expect(() => diffObject({}, input as Record<string, unknown>)).toThrow(DiffValueError);
    });

    it("reports the path of an unrepresentable value", () => {
        expect(() => diffObject({}, { a: { b: new Map() } })).toThrow(/a\.b/);
    });

    it("throws on Infinity", () => {
        expect(() => diffObject({}, { x: Infinity })).toThrow(DiffValueError);
    });

    it("throws when the root value itself is not a plain object", () => {
        expect(() => diffObject({}, new Date() as unknown as Record<string, unknown>)).toThrow(
            DiffValueError,
        );
        expect(() =>
            diffObject({}, new (class Thing {})() as unknown as Record<string, unknown>),
        ).toThrow(DiffValueError);
    });

    it("throws DiffValueError, not a bare RangeError, for an invalid Date", () => {
        expect(() => diffObject({}, { at: new Date("nope") })).toThrow(DiffValueError);
    });

    it("throws DiffValueError, not a RangeError, on a self-referential object", () => {
        const cyclic: Record<string, unknown> = { name: "a" };
        cyclic.self = cyclic;

        expect(() => diffObject({}, cyclic)).toThrow(DiffValueError);
        expect(() => diffObject(cyclic, {})).toThrow(DiffValueError);
        expect(() => diffObject({}, cyclic)).toThrow(/self/);
    });

    it("throws on a cycle that closes further down than the root", () => {
        const inner: Record<string, unknown> = { depth: 2 };
        inner.back = inner;

        expect(() => diffObject({}, { outer: { inner } })).toThrow(DiffValueError);
    });

    it("flattens the same object reached twice through sibling keys — a repeat is not a cycle", () => {
        const shared = { n: 1 };

        expect(diffObject({}, { a: shared, b: shared })).toEqual([
            { type: "obj_add", path: ["a", "n"], curr: 1 },
            { type: "obj_add", path: ["b", "n"], curr: 1 },
        ]);
    });

    it("keeps the error's value readable but non-enumerable", () => {
        expect.assertions(3);
        try {
            diffObject({}, { a: new Map() });
        } catch (err) {
            expect(err).toBeInstanceOf(DiffValueError);
            const diffErr = err as DiffValueError;
            expect(diffErr.value).toBeInstanceOf(Map);
            expect(Object.prototype.propertyIsEnumerable.call(diffErr, "value")).toBe(false);
        }
    });

    it("pins the set-semantics behaviour on duplicate-bearing arrays", () => {
        // A duplicate that collapses away is invisible.
        expect(diffObject({ tags: ["a", "a"] }, { tags: ["a"] })).toEqual([]);

        // A fresh duplicate is reported once per occurrence.
        expect(diffObject({ tags: ["a"] }, { tags: ["b", "b"] })).toEqual([
            { type: "arr_del", path: ["tags"], value: "a" },
            { type: "arr_add", path: ["tags"], value: "b" },
            { type: "arr_add", path: ["tags"], value: "b" },
        ]);
    });
});

describe("DiffChange.schema", () => {
    const changes: DiffChange[] = [
        { type: "obj_add", path: ["name"], curr: "a" },
        { type: "obj_del", path: ["name"], prev: "a" },
        { type: "obj_mod", path: ["name"], prev: "a", curr: "b" },
        { type: "obj_mask", path: ["password"] },
        { type: "arr_add", path: ["tags"], value: "blue" },
        { type: "arr_del", path: ["tags"], value: "red" },
        { type: "arr_ord", path: ["groups"], prev: ["a", "b"], curr: ["b", "a"] },
    ];

    it("round-trips every change type through JSON", () => {
        const roundTripped = JSON.parse(JSON.stringify(changes));
        expect(z.array(DiffChange.schema).parse(roundTripped)).toEqual(changes);
    });

    it("rejects a change carrying a nested object as a value", () => {
        const result = DiffChange.schema.safeParse({
            type: "obj_add",
            path: ["d4h"],
            curr: { categoryId: 12 },
        });
        expect(result.success).toBe(false);
    });

    it("rejects an unknown change type", () => {
        expect(DiffChange.schema.safeParse({ type: "obj_wat", path: ["x"] }).success).toBe(false);
    });
});
