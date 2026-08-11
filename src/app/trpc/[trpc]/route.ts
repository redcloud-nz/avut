/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { cache } from "react";
import { headers as nextHeaders } from "next/headers";

import { TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { auth } from "@/server/auth";
import { createInnerTrpcContext } from "@/trpc/init";
import { assertHasPermissionResult } from "@/trpc/permissions";
import { appRouter } from "@/trpc/routers/_app";

const createTrpcContext = cache(async () => {
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

const handler = (req: Request) =>
    fetchRequestHandler({
        endpoint: "/trpc",
        req,
        router: appRouter,
        createContext: createTrpcContext,
        onError({ error, type, path }) {
            console.error(`tRPC error on ${type} procedure at ${path}:`, error);
        },
    });
export { handler as GET, handler as POST };
