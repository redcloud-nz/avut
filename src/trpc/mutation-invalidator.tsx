/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useEffect } from "react";

import { useQueryClient, type QueryFilters } from "@tanstack/react-query";

declare module "@tanstack/react-query" {
    interface Register {
        mutationMeta: {
            /**
             * Query filters to invalidate after this mutation succeeds, as a function of its
             * variables and result. Read and applied by `MutationInvalidator`.
             */
            invalidates?: (variables: any, data: any) => QueryFilters[]; // eslint-disable-line @typescript-eslint/no-explicit-any
        };
    }
}

/**
 * Bridges tRPC mutations to cache invalidation declared on the mutation itself, rather than
 * repeated at every `useMutation` call site.
 *
 * Patches the shared `mutationCache`'s `onSuccess` once (chaining any previous handler, restored
 * on unmount) so any mutation carrying `meta.invalidates` gets its target queries invalidated
 * automatically. This runs and is awaited *before* a call site's own `onSuccess`, so ordering
 * with UI-level effects (toasts, `router.refresh()`) is unaffected.
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
