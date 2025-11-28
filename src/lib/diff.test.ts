/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { describe, it, expect } from "vitest";
import { diffObject } from "./diff";

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
        expect(result).toEqual([
            { path: ["age"], type: "obj_mod", prev: 30, curr: 31 },
        ]);
    });

    it("should detect array additions", () => {
        const a = { tags: ["red", "blue"] };
        const b = { tags: ["red", "blue", "green"] };

        const result = diffObject(a, b);
        expect(result).toEqual([
            { path: ["tags"], type: "arr_add", value: "green" },
        ]);
    });

    it("should detect array removals", () => {
        const a = { tags: ["red", "blue", "green"] };
        const b = { tags: ["red", "blue"] };

        const result = diffObject(a, b);
        expect(result).toEqual([
            { path: ["tags"], type: "arr_del", value: "green" },
        ]);
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

    it("should handle null and undefined values", () => {
        const a = { value: null, missing: undefined };
        const b = { value: "hello", extra: null };

        const result = diffObject(a, b);
        expect(result).toHaveLength(3);
        expect(result).toContainEqual({
            path: ["value"],
            type: "obj_mod",
            prev: null,
            curr: "hello",
        });
        expect(result).toContainEqual({
            path: ["missing"],
            type: "obj_del",
            prev: undefined,
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
        expect(result).toEqual([
            { path: ["active"], type: "obj_mod", prev: true, curr: false },
        ]);
    });

    it("should handle empty objects", () => {
        const a = {};
        const b = { name: "John" };

        const result = diffObject(a, b);
        expect(result).toEqual([
            { path: ["name"], type: "obj_add", curr: "John" },
        ]);
    });

    it("should handle empty arrays", () => {
        const a = { tags: [] };
        const b = { tags: ["red"] };

        const result = diffObject(a, b);
        expect(result).toEqual([
            { path: ["tags"], type: "arr_add", value: "red" },
        ]);
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
});
