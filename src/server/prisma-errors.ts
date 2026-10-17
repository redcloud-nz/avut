/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import "server-only";

/**
 * Whether `error` is Prisma's `P2025` "record to update/delete not found": a write whose `where`
 * matched no row. A conditional write (e.g. `update` guarded on a status) raises it when it lost
 * a race, so callers map it to the domain error their pre-check would have thrown.
 *
 * Duck-typed on `code` rather than `instanceof PrismaClientKnownRequestError`, so a test can
 * fake the lost race with a plain `Error` carrying `code: "P2025"`.
 */
export function isPrismaRecordNotFound(error: unknown): boolean {
    return error instanceof Object && "code" in error && error.code === "P2025";
}

/**
 * Whether `error` is Prisma's `P2002` unique-constraint violation: what a concurrent duplicate
 * insert raises after a `findFirst`/`findUnique` pre-check has already passed, so callers map it
 * to the domain error their pre-check would have thrown.
 *
 * Duck-typed on `code` for the same reason as `isPrismaRecordNotFound`.
 */
export function isUniqueViolation(error: unknown): boolean {
    return error instanceof Object && "code" in error && error.code === "P2002";
}
