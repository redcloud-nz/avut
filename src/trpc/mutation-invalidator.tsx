/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useEffect } from "react";

import { useQueryClient, type QueryFilters, type QueryKey } from "@tanstack/react-query";

declare module "@tanstack/react-query" {
    interface Register {
        mutationMeta: {
            /**
             * Query filters to invalidate after this mutation succeeds, as a function of its
             * variables and result. Read and applied by `MutationInvalidator`.
             *
             * Best suited to queries a single mutation response can't fully determine the new
             * value of — list/collection queries, where membership, sort order, or pagination
             * may have changed. For a single-entity query the mutation's response already *is*
             * the new value — prefer `writes` for those, so the UI updates instantly instead of
             * waiting on a refetch.
             */
            invalidates?: (variables: any, data: any) => QueryFilters[]; // eslint-disable-line @typescript-eslint/no-explicit-any

            /**
             * Exact query cache entries to overwrite with data from this mutation's response, as
             * a function of its variables and result. Read and applied by `MutationInvalidator`
             * via `queryClient.setQueryData`, before `invalidates` runs.
             *
             * Unlike `invalidates`, this targets one specific cached query (e.g. a `getX` detail
             * query) with an exact `queryKey`, not a fuzzy filter — it replaces that entry's data
             * wholesale with the mutation's response, so it's only correct when the response
             * carries the *full* value the query would otherwise fetch.
             */
            writes?: (variables: any, data: any) => Array<{ queryKey: QueryKey; data: unknown }>; // eslint-disable-line @typescript-eslint/no-explicit-any
        };
    }
}

/**
 * Bridges tRPC mutations to cache invalidation and direct cache writes declared on the mutation
 * itself, rather than repeated at every `useMutation` call site.
 *
 * Patches the shared `mutationCache`'s `onSuccess` once (chaining any previous handler, restored
 * on unmount) so any mutation carrying `meta.writes` and/or `meta.invalidates` gets its target
 * queries updated automatically — writes first (synchronous cache overwrite), then invalidations
 * (may trigger a background refetch of any still-stale, still-active queries). This runs and is
 * awaited *before* a call site's own `onSuccess`, so ordering with UI-level effects (toasts,
 * `router.refresh()`) is unaffected.
 *
 * Mount once as a sibling of `QueryClientProvider`'s children.
 */
export function MutationInvalidator() {
    const queryClient = useQueryClient();

    useEffect(() => {
        const mutationCache = queryClient.getMutationCache();
        const previousOnSuccess = mutationCache.config.onSuccess;

        mutationCache.config.onSuccess = async (
            data,
            variables,
            onMutateResult,
            mutation,
            context,
        ) => {
            await previousOnSuccess?.(data, variables, onMutateResult, mutation, context);

            const writes = mutation.meta?.writes;
            writes?.(variables, data).forEach(({ queryKey, data }) => {
                queryClient.setQueryData(queryKey, data);
            });

            const invalidates = mutation.meta?.invalidates;
            if (!invalidates) return;

            await Promise.all(
                invalidates(variables, data).map((filter) => queryClient.invalidateQueries(filter)),
            );
        };

        return () => {
            mutationCache.config.onSuccess = previousOnSuccess;
        };
    }, [queryClient]);

    return null;
}
