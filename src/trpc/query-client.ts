/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import {
    defaultShouldDehydrateQuery,
    environmentManager,
    QueryClient,
} from "@tanstack/react-query";
import superjson from "superjson";

import { authQueryKeys, authQueryRetryOptions } from "@/lib/auth-query-keys";

export function makeQueryClient() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000 * 10,
            },
            dehydrate: {
                serializeData: superjson.serialize,
                // `defaultShouldDehydrateQuery` covers settled queries; the `pending` arm is
                // the tRPC streaming-prefetch idiom, where the client picks up the in-flight
                // promise. Both are needed: an awaited `ensureQueryData` leaves the query in
                // `success`, so a pending-only predicate would silently drop it and the
                // client would refetch anyway.
                shouldDehydrateQuery: (query) =>
                    defaultShouldDehydrateQuery(query) || query.state.status === "pending",
            },
            hydrate: {
                deserializeData: superjson.deserialize,
            },
        },
    });

    // Must be set before any descendant renders — queries resolve their defaults during
    // render, so a later call would not apply to them.
    queryClient.setQueryDefaults(authQueryKeys.all, authQueryRetryOptions);

    return queryClient;
}

let clientQueryClientSingleton: QueryClient;

/**
 * Get the query client for the current environment.
 *
 * A fresh client per request on the server (so one user's cache never leaks into another's),
 * a singleton in the browser.
 *
 * Lives here rather than in `./client` so server components can reach it — `./client` is a
 * `"use client"` module.
 */
export function getQueryClient() {
    if (environmentManager.isServer()) {
        // Server, always make a new query client
        return makeQueryClient();
    } else {
        // Client, reuse singleton
        return (clientQueryClientSingleton ??= makeQueryClient());
    }
}
