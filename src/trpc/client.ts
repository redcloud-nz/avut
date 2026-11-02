/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import superjson from "superjson";

import { createTRPCClient, httpBatchLink, TRPCClientError, type TRPCLink } from "@trpc/client";
import { observable } from "@trpc/server/observable";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import { getQueryClient } from "./query-client";
import type { AppRouter, RouterInput, RouterOutput } from "./routers/_app";

// Re-exported for the many client components that import it from here.
export { getQueryClient };

/**
 * The link used while a client component renders on the server: it fails every call at once.
 *
 * A call made here would go out over HTTP without the request's cookies, so an authenticated
 * procedure could only answer `UNAUTHORIZED`. It happens when a `useSuspenseQuery` finds nothing
 * hydrated under its key: the page didn't `prefetch` it, or the prefetch failed before
 * `HydrateClient` dehydrated (React Query dehydrates pending and settled queries, not errored
 * ones). Failing here ends in the same place as the 401 did — React abandons the server render
 * of that boundary and the browser fetches with its session — without the round trip or the
 * misleading auth error in the server log.
 */
const serverRenderLink: TRPCLink<AppRouter> =
    () =>
    ({ op }) =>
        observable((observer) => {
            observer.error(
                TRPCClientError.from(
                    new Error(
                        `${op.path} was called during the server render, where nothing was hydrated for it: either no server prefetch, or one that failed. The browser fetches it instead.`,
                    ),
                ),
            );
        });

export const trpcClient = createTRPCClient<AppRouter>({
    links: [
        typeof window === "undefined"
            ? serverRenderLink
            : httpBatchLink({ transformer: superjson, url: "/trpc" }),
    ],
});

export const trpc = createTRPCOptionsProxy<AppRouter>({
    client: trpcClient,
    queryClient: getQueryClient(),
});

export { RouterInput, RouterOutput };
