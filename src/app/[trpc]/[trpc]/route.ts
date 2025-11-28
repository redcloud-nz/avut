/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createTrpcContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";

const handler = (req: Request) =>
    fetchRequestHandler({
        endpoint: "/trpc",
        req,
        router: appRouter,
        createContext: createTrpcContext,
    });
export { handler as GET, handler as POST };
