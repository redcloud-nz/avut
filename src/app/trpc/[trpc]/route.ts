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
import { appRouter } from "@/trpc/routers/_app";

const createTrpcContext = cache(async () => {
    const headers = await nextHeaders();

    const authSession = await auth.api.getSession({ headers });

    return createInnerTrpcContext({
        auth: authSession,
        hasPermission: async (organizationId, requiredPermissions) => {
            try {
                await auth.api.hasPermission({
                    headers,
                    body: { organizationId, permissions: requiredPermissions },
                });
            } catch (error) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message:
                        "Insufficient permissions. Action requires: " +
                        JSON.stringify(requiredPermissions),
                    cause: error,
                });
            }
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
