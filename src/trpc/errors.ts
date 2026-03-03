/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { TRPCError } from "@trpc/server";

export class FieldConflictError extends Error {
    readonly fieldName: string;

    constructor(fieldName: string, message?: string) {
        super(message ?? fieldName);
        this.fieldName = fieldName;
        this.name = "FieldConflictError";
    }
}
