/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { headers as nextHeaders } from "next/headers";
import { cache } from "react";

import { TRPCError } from "@trpc/server";

import { auth } from "@/server/auth";
import { createInnerTrpcContext } from "@/trpc/init";
import { assertHasPermissionResult } from "@/trpc/permissions";

/**
 * Build the tRPC context for the current request.
 *
 * React `cache` holds it to a single session lookup per request, whether the caller is the
 * HTTP handler or a server component prefetching through `@/trpc/server`.
 */
export const createTrpcContext = cache(async () => {
    const headers = await nextHeaders();

    const authSession = await auth.api.getSession({ headers });

    return createInnerTrpcContext({
        auth: authSession,
        hasPermission: async (organizationId, requiredPermissions) => {
            let result;
            try {
                result = await auth.api.hasPermission({
                    headers,
                    body: { organizationId, permissions: requiredPermissions },
                });
            } catch (error) {
                // Better Auth throws UNAUTHORIZED when the user is not a member of the
                // organization at all.
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You are not a member of this organization.",
                    cause: error,
                });
            }

            // ...and returns `{ success: false }` when they are a member but lack the
            // permission. Both have to be checked.
            assertHasPermissionResult(result, requiredPermissions);
        },
        headers,
    });
});
