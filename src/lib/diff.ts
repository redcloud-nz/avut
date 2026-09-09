/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { isPlainObject } from "remeda";
import * as z from "zod";

/** A scalar a change can carry. */
export type DiffValue = string | number | boolean | null;

/** A scalar, or a list of scalars, a change can carry. */
export type DiffValues = DiffValue | DiffValue[];

/**
 * Either side of a diff.
 *
 * Deliberately permissive: values are checked at runtime by `flatten` and throw if they cannot be
 * faithfully represented, rather than being constrained by the type. This is what lets a caller
 * pass a raw Prisma record and get a correct entry (dates convert) instead of a compile error.
 */
export type DiffInput = Record<string, unknown>;

const diffValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const diffValuesSchema = z.union([diffValueSchema, z.array(diffValueSchema)]);

const pathSchema = z.array(z.string());

export const DiffChange = {
    schema: z.discriminatedUnion("type", [
        /** An object key was added. */
        z.object({ type: z.literal("obj_add"), path: pathSchema, curr: diffValuesSchema }),
        /** An object key was removed. */
        z.object({ type: z.literal("obj_del"), path: pathSchema, prev: diffValuesSchema }),
        /** An object key changed value. */
        z.object({
            type: z.literal("obj_mod"),
            path: pathSchema,
            prev: diffValuesSchema,
            curr: diffValuesSchema,
        }),
        /** An object key changed, but its values are withheld (e.g. a password). */
        z.object({ type: z.literal("obj_mask"), path: pathSchema }),
        /** A value was added to an array. */
        z.object({ type: z.literal("arr_add"), path: pathSchema, value: diffValueSchema }),
        /** A value was removed from an array. */
        z.object({ type: z.literal("arr_del"), path: pathSchema, value: diffValueSchema }),
        /** An array was reordered. */
        z.object({
            type: z.literal("arr_ord"),
            path: pathSchema,
            prev: z.array(diffValueSchema),
            curr: z.array(diffValueSchema),
        }),
    ]),
} as const;

export type DiffChange = z.infer<typeof DiffChange.schema>;

/** Thrown when a value cannot be faithfully represented in a change. */
export class DiffValueError extends Error {
    readonly path: string[];
    declare readonly value: unknown;

    constructor(path: string[], value: unknown) {
        super(`Cannot diff value at "${path.join(".")}": not representable`);
        this.name = "DiffValueError";
        this.path = path;
        // Non-enumerable so a structured logger that serializes an Error's own
        // enumerable properties never echoes the raw value it names.
        Object.defineProperty(this, "value", { value, enumerable: false });
    }
}

function isDiffValue(value: unknown): value is DiffValue {
    if (value === null) return true;
    if (typeof value === "string" || typeof value === "boolean") return true;
    return typeof value === "number" && Number.isFinite(value);
}

interface Leaf {
    path: string[];
    value: DiffValues;
}

/**
 * Reduce an object to a list of scalar leaves.
 *
 * This is the only place value-type policy lives:
 * - plain object -> recurse
 * - scalar -> leaf
 * - array of scalars -> leaf (the whole array)
 * - Date -> leaf, as an ISO string
 * - undefined -> absent
 * - anything else -> throw
 *
 * The policy applies to the top-level input too: `input` itself must be a plain
 * object, or this throws rather than silently iterating zero keys.
 *
 * A cyclic object is "anything else": it is caught explicitly and throws
 * `DiffValueError`, rather than recursing until the stack blows and raising a
 * `RangeError` the documented contract does not mention.
 */
function flatten(input: DiffInput): Leaf[] {
    if (!isPlainObject(input)) throw new DiffValueError([], input);

    const leaves: Leaf[] = [];

    // Objects on the path from the root to the value being visited. Only ancestors
    // count: the same object reached twice through sibling keys is a repeat, which
    // flattens fine, not a cycle.
    const ancestors = new Set<object>([input]);

    function recurse(value: unknown, path: string[]): void {
        if (value === undefined) return;

        if (isDiffValue(value)) {
            leaves.push({ path, value });
        } else if (value instanceof Date) {
            if (Number.isNaN(value.getTime())) throw new DiffValueError(path, value);
            leaves.push({ path, value: value.toISOString() });
        } else if (Array.isArray(value)) {
            if (!value.every(isDiffValue)) throw new DiffValueError(path, value);
            leaves.push({ path, value: value as DiffValue[] });
        } else if (isPlainObject(value)) {
            if (ancestors.has(value)) throw new DiffValueError(path, value);
            ancestors.add(value);
            for (const key of Object.keys(value)) {
                recurse((value as DiffInput)[key], [...path, key]);
            }
            ancestors.delete(value);
        } else {
            throw new DiffValueError(path, value);
        }
    }

    for (const key of Object.keys(input)) recurse(input[key], [key]);

    return leaves;
}

/**
 * Calculate the difference between two objects.
 *
 * Both sides are flattened to scalar leaves, then compared by path. Arrays of scalars are compared
 * as sets — `tags` is a set, so `+blue` is the right reading. Reordering is not inferred; a caller
 * that reorders something constructs an `arr_ord` change directly.
 *
 * Out of contract: arrays holding duplicate values. Set semantics means a duplicate collapses
 * (`["a","a"] -> ["a"]` reports no change) and a fresh duplicate can be reported twice
 * (`["a"] -> ["b","b"]` emits two `arr_add "b"`). This is deliberate — `diffObject` is exported
 * as a general `Record<string, unknown>` utility, but every current caller's schema (e.g.
 * `tagsSchema`) already forbids duplicates, so the algorithm is not changed to handle them.
 *
 * @param a Initial object.
 * @param b Changed object.
 * @returns Array of changes.
 * @throws DiffValueError if either side holds a value that cannot be represented.
 */
export function diffObject(a: DiffInput, b: DiffInput): DiffChange[] {
    const changes: DiffChange[] = [];

    const keyOf = (path: string[]) => JSON.stringify(path);

    const leavesA = flatten(a);
    const leavesB = flatten(b);

    const byPathB = new Map(leavesB.map((leaf) => [keyOf(leaf.path), leaf]));
    const seen = new Set<string>();

    for (const { path, value: prev } of leavesA) {
        const key = keyOf(path);
        seen.add(key);

        const match = byPathB.get(key);
        if (!match) {
            changes.push({ type: "obj_del", path, prev });
            continue;
        }

        const curr = match.value;

        if (Array.isArray(prev) && Array.isArray(curr)) {
            for (const value of prev) {
                if (!curr.includes(value)) changes.push({ type: "arr_del", path, value });
            }
            for (const value of curr) {
                if (!prev.includes(value)) changes.push({ type: "arr_add", path, value });
            }
        } else if (Array.isArray(prev) || Array.isArray(curr) || prev !== curr) {
            changes.push({ type: "obj_mod", path, prev, curr });
        }
    }

    for (const { path, value: curr } of leavesB) {
        if (!seen.has(keyOf(path))) changes.push({ type: "obj_add", path, curr });
    }

    return changes;
}
