/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { TRPCError } from "@trpc/server";

import { Permissions } from "@/lib/permissions";

/**
 * Translate a Better Auth `hasPermission` result into a tRPC error.
 *
 * Better Auth signals denial two different ways: it *throws* UNAUTHORIZED when the user is
 * not a member of the organization, and it *returns* `{ success: false }` when they are a
 * member but lack the permission. Handling only the throw grants every permission to every
 * member, so the returned flag has to be inspected too.
 *
 * Lives here rather than in the route handler so it can be tested without pulling in
 * server-only modules.
 */
export function assertHasPermissionResult(
    result: { success: boolean },
    requiredPermissions: Permissions,
): void {
    if (!result.success) {
        throw new TRPCError({
            code: "FORBIDDEN",
            message: `Insufficient permissions. Action requires: ${JSON.stringify(requiredPermissions)}`,
        });
    }
}
