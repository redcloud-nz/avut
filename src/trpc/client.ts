/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import superjson from "superjson";

import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import { env } from "@/lib/env";

import { getQueryClient } from "./query-client";
import type { AppRouter, RouterInput, RouterOutput } from "./routers/_app";

// Re-exported for the many client components that import it from here.
export { getQueryClient };

function getUrl() {
    const base = (() => {
        if (typeof window !== "undefined") return "";
        else if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
        else return `http://localhost:${env.PORT ?? 3000}`;
    })();

    return `${base}/trpc`;
}

export const trpcClient = createTRPCClient<AppRouter>({
    links: [
        httpBatchLink({
            transformer: superjson,
            url: getUrl(),
        }),
    ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
    client: trpcClient,
    queryClient: getQueryClient(),
});

export { RouterInput, RouterOutput };
