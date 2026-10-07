/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import superjson from "superjson";

import {
    defaultShouldDehydrateQuery,
    environmentManager,
    MutationCache,
    QueryCache,
    QueryClient,
} from "@tanstack/react-query";

import { authQueryKeys, authQueryRetryOptions } from "@/lib/auth-query-keys";

const MAX_QUERY_RETRIES = 3;

/** A field of a failed tRPC call's error data (`TRPCClientError.data`), if present. */
function trpcErrorDataField(error: unknown, field: "httpStatus" | "code"): unknown {
    if (typeof error !== "object" || error === null || !("data" in error)) return undefined;
    const data = (error as { data?: unknown }).data;
    if (typeof data !== "object" || data === null) return undefined;
    return (data as Record<string, unknown>)[field];
}

/** The HTTP status a failed tRPC call carries (`TRPCClientError.data.httpStatus`), if any. */
function trpcHttpStatusOf(error: unknown): number | undefined {
    const status = trpcErrorDataField(error, "httpStatus");
    return typeof status === "number" ? status : undefined;
}

/**
 * The key prefix of `trpc.user.getSession` (the session query behind `useSession()`). Spelled
 * out as tRPC's `[path, { type }]` key shape, because this module also runs on the server and
 * can't import the client `trpc` proxy. `query-client.test.ts` checks it against the proxy.
 */
export const SESSION_QUERY_KEY_PREFIX = [["user", "getSession"]] as const;

/**
 * Any tRPC call that comes back `UNAUTHORIZED` means the session has gone: expired, revoked
 * from another device, or signed out in another tab. Refetch the session straight away, so
 * `SessionWatcher` sees `null` and sends the user to sign-in, rather than the page carrying
 * on and failing call by call until the session query's own 5-minute staleness runs out.
 * `getSession` is a public procedure, so this can't loop. `cancelRefetch: false` lets a
 * burst of failures share one in-flight refetch.
 */
function recheckSessionOnUnauthorized(queryClient: QueryClient, error: unknown) {
    if (environmentManager.isServer()) return;
    if (trpcErrorDataField(error, "code") !== "UNAUTHORIZED") return;

    void queryClient.invalidateQueries(
        { queryKey: SESSION_QUERY_KEY_PREFIX },
        { cancelRefetch: false },
    );
}

/**
 * Retry a failed query unless it's a 4xx a retry can't change — `UNAUTHORIZED`, `FORBIDDEN`,
 * `NOT_FOUND`, `BAD_REQUEST`. React Query's default retries everything three times, so one
 * unauthenticated call became four requests and four server-side error logs. Network
 * failures (no status), 5xx, 408 and 429 still retry. Never on the server, matching React
 * Query's own server default, so SSR doesn't sit in a backoff loop.
 */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
    if (environmentManager.isServer()) return false;
    if (failureCount >= MAX_QUERY_RETRIES) return false;

    const status = trpcHttpStatusOf(error);
    return status === undefined || status >= 500 || status === 408 || status === 429;
}

export function makeQueryClient() {
    const queryClient: QueryClient = new QueryClient({
        queryCache: new QueryCache({
            onError: (error) => recheckSessionOnUnauthorized(queryClient, error),
        }),
        mutationCache: new MutationCache({
            onError: (error) => recheckSessionOnUnauthorized(queryClient, error),
        }),
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000 * 10,
                retry: shouldRetryQuery,
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
