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
