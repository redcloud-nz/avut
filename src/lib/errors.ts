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
 * Error thrown when the user is authenticated but lacks the permissions required for the requested resource.
 */
export class ForbiddenError extends Error {
    constructor(message = "You do not have permission to perform this action.") {
        super(message);
        this.name = "ForbiddenError";
    }
}
