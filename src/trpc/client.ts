/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import superjson from "superjson";

import { type QueryClient, isServer } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import { makeQueryClient } from "./query-client";
import type { AppRouter, RouterInput, RouterOutput } from "./routers/_app";

let clientQueryClientSingleton: QueryClient;

export function getQueryClient() {
    if (isServer) {
        // Server, always make a new query client
        return makeQueryClient();
    } else {
        // Client, reuse singleton
        return (clientQueryClientSingleton ??= makeQueryClient());
    }
}

function getUrl() {
    const base = (() => {
        if (typeof window !== "undefined") return "";
        else if (process.env.VERCEL_URL)
            return `https://${process.env.VERCEL_URL}`;
        else return `http://localhost:${process.env.PORT ?? 3000}`;
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
