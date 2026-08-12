/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { FieldConflictError } from "./errors";

/** The parts of tRPC's default error shape this formatter reads. */
export interface TrpcErrorShape {
    message: string;
    code: number;
    data: Record<string, unknown>;
}

/**
 * Extend tRPC's default error shape with structured field-conflict details.
 *
 * Lives outside `init.ts` so it can be tested without standing up a router.
 *
 * Note the `data` spread: it merges into `shape.data`, *not* `shape`. Spreading the whole
 * shape would overwrite `data.code` — the string tRPC code the client error mapper reads —
 * with the numeric JSON-RPC code.
 */
export function formatTrpcError<TShape extends TrpcErrorShape>({
    shape,
    error,
}: {
    shape: TShape;
    error: { code?: string; cause?: any };
}): any {
    const conflict =
        error.code == "CONFLICT" && error.cause instanceof FieldConflictError
            ? { fieldName: error.cause.fieldName, message: error.cause.message }
            : undefined;

    return {
        ...shape,
        cause: error.cause,
        data: {
            ...shape.data,
            conflict,
        },
    };
}
