/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { TRPCError } from "@trpc/server";

import { Permissions, Role, Roles } from "@/lib/permissions";

/**
 * Whether any of the given roles authorizes every one of `requiredPermissions`.
 *
 * Mirrors `useHasPermission`'s client-side union of roles and Better Auth's own
 * `hasPermissionFn` semantics (granted if a single role authorises the full request) — that
 * three-way agreement is what makes evaluating locally, against a role lookup already in hand,
 * a safe substitute for a second `auth.api.hasPermission` round trip. See
 * `createTrpcContext`'s `hasPermission` in `@/server/trpc-context`, the only caller.
 *
 * Lives here rather than there so it can be tested without pulling in server-only modules.
 */
export function hasAnyRoleWithPermissions(
    roles: Role[],
    requiredPermissions: Permissions,
): boolean {
    return roles.some((role) => Roles[role].authorize(requiredPermissions).success);
}

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
