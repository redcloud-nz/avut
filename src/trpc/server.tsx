/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { forbidden, notFound } from "next/navigation";
import { cache, type ReactNode } from "react";

import {
    dehydrate,
    HydrationBoundary,
    type FetchQueryOptions,
    type QueryKey,
} from "@tanstack/react-query";
import { TRPCError } from "@trpc/server";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import { createTrpcContext } from "@/server/trpc-context";

import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers/_app";

/**
 * The request-scoped query client for server components.
 *
 * React `cache` is the whole trick: a page's `prefetch` and the `HydrateClient` that
 * dehydrates it have to be handed the same instance, or the payload ships empty.
 *
 * Distinct from `getQueryClient` in `@/trpc/client`, which is the browser singleton (and a
 * fresh instance per SSR render). Do not swap one for the other.
 */
export const getServerQueryClient = cache(makeQueryClient);

/**
 * Server-side tRPC proxy.
 *
 * Calls the router in-process rather than over HTTP, so the request's cookies come from
 * `next/headers` instead of being dropped by a loopback fetch. Query keys match those the
 * client proxy produces, which is what lets a prefetch here satisfy a `useSuspenseQuery`
 * there.
 *
 * Never use the `trpc` export from `@/trpc/client` in a server component — its `queryFn`
 * goes back over HTTP unauthenticated.
 */
export const trpc = createTRPCOptionsProxy({
    ctx: createTrpcContext,
    router: appRouter,
    queryClient: getServerQueryClient,
});

/**
 * Warm the request-scoped cache.
 *
 * Deliberately not awaited, and never throws: server render does not block on it, and a
 * failure surfaces on the client, where `describeError` renders it. When a server component
 * actually needs the value — a page title, a breadcrumb — call
 * `getServerQueryClient().fetchQuery(...)` instead, which awaits and throws.
 */
export function prefetch<TQueryFnData, TError, TData, TQueryKey extends QueryKey>(
    queryOptions: FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
) {
    void getServerQueryClient().prefetchQuery(queryOptions);
}

/**
 * Await a query on the server, translating tRPC's error codes into Next's interrupts.
 *
 * Use this rather than `getServerQueryClient().fetchQuery(...)` directly. A `TRPCError`
 * thrown from a server component reaches the client error boundary with its class dropped
 * and, in production, its message replaced — so a NOT_FOUND would render as a generic
 * failure instead of the 404 page. Interrupts survive that boundary intact.
 *
 * The result lands in the request-scoped cache, so a later `prefetch` of the same key is a
 * hit rather than a second round trip.
 */
export async function fetchQuery<TQueryFnData, TError, TData, TQueryKey extends QueryKey>(
    queryOptions: FetchQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
): Promise<TData> {
    try {
        return await getServerQueryClient().fetchQuery(queryOptions);
    } catch (error) {
        if (error instanceof TRPCError) {
            if (error.code === "NOT_FOUND") notFound();
            if (error.code === "FORBIDDEN") forbidden();
        }
        throw error;
    }
}

/**
 * Dehydrate whatever the request-scoped client holds into a boundary the client picks up.
 *
 * Nesting is additive and safe. Note that in RSC a layout's body runs before its page's
 * body, so a `HydrateClient` in a layout captures only what that layout prefetched — a page
 * that prefetches needs its own.
 */
export function HydrateClient({ children }: { children: ReactNode }) {
    return (
        <HydrationBoundary state={dehydrate(getServerQueryClient())}>{children}</HydrationBoundary>
    );
}
