/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Thrown by `applyD4HTeamSync` when the freshly-recomputed plan no longer matches
 * the `planToken` the user previewed. Carried as a `TRPCError` `cause` so the sync
 * dialog can detect it (`error.shape?.cause?.name === "StalePlanError"`) and
 * re-fetch the plan for re-approval. No writes happen.
 */
export class StalePlanError extends Error {
    constructor(message?: string) {
        super(
            message ??
                "The D4H data changed since you previewed. Review the updated changes and confirm again.",
        );
        this.name = "StalePlanError";
    }
}

export class FieldConflictError extends Error {
    readonly fieldName: string;

    constructor(fieldName: string, message?: string) {
        super(message ?? fieldName);
        this.fieldName = fieldName;
        this.name = "FieldConflictError";
    }
}
