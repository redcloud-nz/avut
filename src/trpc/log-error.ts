/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import type { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";

/**
 * The `onError` logger for the `/trpc` handler.
 *
 * A 5xx is a fault on our side, so it gets `console.error` with the full error and stack. A 4xx
 * (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_REQUEST`, …) is the API answering correctly,
 * and a stack trace for each one buries the real errors, so it gets one `console.warn` line.
 */
export function logTrpcError({
    error,
    type,
    path,
}: {
    error: TRPCError;
    type: string;
    path: string | undefined;
}): void {
    const where = `${type} procedure at ${path ?? "<unknown>"}`;

    if (getHTTPStatusCodeFromError(error) >= 500) {
        console.error(`[trpc] Error on ${where}:`, error);
    } else {
        console.warn(`[trpc] ${error.code} on ${where}: ${error.message}`);
    }
}
