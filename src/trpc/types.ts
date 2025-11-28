/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

export class FieldConflictError extends Error {
    constructor(fieldName: string) {
        super(fieldName);
        this.name = "FieldConflictError";
    }
}
