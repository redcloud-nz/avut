/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { headers as nextHeaders } from "next/headers";
import { cache } from "react";

import { TRPCError } from "@trpc/server";

import { hasAnyRoleWithPermissions } from "@/lib/permissions";
import { getOrganizationUserRolesOrNull } from "@/server/cache/organization-user";
import { getSession } from "@/server/session";
import { createInnerTrpcContext } from "@/trpc/init";
import { assertHasPermissionResult } from "@/trpc/permissions";

/**
 * Build the tRPC context for the current request.
 *
 * React `cache` holds it to a single session lookup per request, whether the caller is the
 * HTTP handler or a server component prefetching through `@/trpc/server`.
 */
export const createTrpcContext = cache(async () => {
    const authSession = await getSession();

    return createInnerTrpcContext({
        auth: authSession,
        hasPermission: async (organizationId, requiredPermissions) => {
            if (!authSession) {
                throw new TRPCError({ code: "UNAUTHORIZED" });
            }

            // Evaluated locally against the cached role lookup rather than calling Better
            // Auth's `auth.api.hasPermission` — that would be a second DB round trip doing
            // the same membership lookup `getOrganizationUserRolesOrNull` already does, just
            // to re-derive a result `hasAnyRoleWithPermissions` (same access-control config,
            // see `src/lib/permissions.ts`) can compute in memory.
            const roles = await getOrganizationUserRolesOrNull(organizationId, authSession.user.id);

            if (!roles) {
                // Not a member of the organization at all.
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You are not a member of this organisation.",
                });
            }

            const granted = hasAnyRoleWithPermissions(roles, requiredPermissions);

            assertHasPermissionResult({ success: granted }, requiredPermissions);
        },
        getHeaders: nextHeaders,
    });
});
