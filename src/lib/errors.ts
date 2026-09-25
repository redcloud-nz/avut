/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

/**
 * Error thrown when the organization or user is not properly configured to use a requested feature or integration.
 */
export class NotConfiguredError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NotConfiguredError";
    }
}

export class InvalidD4HAccessTokenError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "InvalidD4HAccessTokenError";
    }
}

/**
 * Error thrown when a module's own layout gate finds the module disabled for the current
 * organization — either by its environment flag or by `settings.modules.<id>.enabled`.
 */
export class NotEnabledError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NotEnabledError";
    }
}

/**
 * Error thrown by a domain service when the requested record does not exist (or is out of the
 * caller's scope). A base-procedure middleware (`src/trpc/init.ts`) catches this and rethrows a
 * `TRPCError({ code: "NOT_FOUND" })` with this error as its `cause`, so services stay free of any
 * tRPC dependency.
 */
export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NotFoundError";
    }
}

/**
 * Error thrown by a domain service when a write would conflict with existing state (e.g. a
 * uniqueness rule). Mapped to `TRPCError({ code: "CONFLICT" })` the same way as `NotFoundError`.
 * For a conflict the UI needs to attribute to one input field, throw `FieldConflictError`
 * (`src/trpc/errors.ts`) instead — that one already carries `fieldName` through to the client.
 */
export class ConflictError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ConflictError";
    }
}
