/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { customAlphabet } from "nanoid";
import { v4 as uuidv4, validate } from "uuid";
import { z } from "zod";

/**
 * Create a new v4 UUID
 * @returns A new UUID
 */
export function createUUID(): string {
    return uuidv4();
}

/**
 * Validate a UUID
 * @param id The id to validate
 * @returns True if the id is a valid UUID, false otherwise
 */
export function validateUUID(id: string): boolean {
    return validate(id);
}

export const NilUUID = "00000000-0000-0000-0000-000000000000";

export class IDValidationSet {
    private readonly ids = new Set<string>();

    validate(id: string) {
        if (this.ids.has(id)) throw new Error(`Duplicate UUID: ${id}`);

        this.ids.add(id);
    }
}

export function createWhereClause(uuidOrRef: string) {
    return validateUUID(uuidOrRef) ? { id: uuidOrRef } : { ref: uuidOrRef };
}

const alphabet = customAlphabet(
    "1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
    16,
);

export function nanoId8() {
    return alphabet(8);
}

export function nanoId16() {
    return alphabet(16);
}

export function validateNanoid8(id: string) {
    return id.length === 8 && /^[0-9A-Za-z]+$/.test(id);
}

export function validateNanoid16(id: string) {
    return id.length === 16 && /^[0-9A-Za-z]+$/.test(id);
}

export const EMPTY = "" as string & z.BRAND<"Empty">;
