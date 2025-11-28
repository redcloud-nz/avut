/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { isArray, isObjectType } from "remeda";

type DiffableArray = (string | number)[];

type Diffable =
    | string
    | number
    | boolean
    | null
    | undefined
    | DiffableArray
    | DiffableObject;

type DiffableObject = { [key: string]: Diffable };

interface DiffChangeBase {
    path: string[];
}

/**
 * Represent the addition of an object key.
 */
interface DiffObjectAdd extends DiffChangeBase {
    type: "obj_add";
    curr: Diffable;
}

/**
 * Represent the removal of an object key.
 */
interface DiffObjectRemove extends DiffChangeBase {
    type: "obj_del";
    prev: Diffable;
}

/**
 * Represent the modification of an object key.
 */
interface DiffObjectModify extends DiffChangeBase {
    type: "obj_mod";
    prev: Diffable;
    curr: Diffable;
}

/**
 * Represent the addition of a value to an array.
 */
interface DiffArrayAdd extends DiffChangeBase {
    type: "arr_add";
    value: Diffable;
}

/**
 * Represent the removal of a value from an array.
 */
interface DiffArrayRemove extends DiffChangeBase {
    type: "arr_del";
    value: Diffable;
}

export type DiffChange =
    | DiffObjectAdd
    | DiffObjectRemove
    | DiffObjectModify
    | DiffArrayAdd
    | DiffArrayRemove;

/**
 * Calculate the difference between two objects.
 * @param a Initial object.
 * @param b Changed object.
 * @returns Array of changes.
 */
export function diffObject(a: DiffableObject, b: DiffableObject): DiffChange[] {
    const changes: DiffChange[] = [];

    for (const key in a) {
        if (!b.hasOwnProperty(key)) {
            // Entry is in a but not in b
            changes.push({ path: [key], type: "obj_del", prev: a[key] });
        } else if (isArray(a[key]) && isArray(b[key])) {
            const arrayA = a[key];
            const arrayB = b[key];

            // Find removed items
            for (const item of arrayA) {
                if (!arrayB.includes(item)) {
                    changes.push({ path: [key], type: "arr_del", value: item });
                }
            }

            // Find added items
            for (const item of arrayB) {
                if (!arrayA.includes(item)) {
                    changes.push({ path: [key], type: "arr_add", value: item });
                }
            }
        } else if (isObjectType(a[key]) && isObjectType(b[key])) {
            // Both are objects, do a recursive diff
            const nestedChanges = diffObject(
                a[key] as { [key: string]: Diffable },
                b[key] as { [key: string]: Diffable },
            );
            nestedChanges.forEach(({ path, ...change }) => {
                changes.push({ path: [key, ...path], ...change });
            });
        } else if (a[key] !== b[key]) {
            // Values are different
            changes.push({
                path: [key],
                type: "obj_mod",
                prev: a[key],
                curr: b[key],
            });
        }
    }

    for (const key in b) {
        if (!a.hasOwnProperty(key)) {
            // Entry is in b but not in a
            changes.push({ path: [key], type: "obj_add", curr: b[key] });
        }
    }

    return changes;
}
