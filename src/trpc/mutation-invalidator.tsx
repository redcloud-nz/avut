/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useEffect } from "react";

import { useQueryClient, type QueryFilters, type QueryKey } from "@tanstack/react-query";

/**
 * A single cache side-effect to apply after a mutation succeeds — either an exact-key write or a
 * fuzzy-filter invalidation. Build these with `write()`/`invalidate()` rather than the object
 * literal shape directly. See `meta.effects` below.
 */
export type MutationEffect =
    | { type: "write"; queryKey: QueryKey; data: unknown | ((old: unknown) => unknown) }
    | { type: "invalidate"; filter: QueryFilters };

/**
 * Declares an exact query cache entry to overwrite with data from a mutation's response.
 *
 * Unlike `invalidate()`, this targets one specific cached query (e.g. a `getX` detail query) with
 * an exact `queryKey`, not a fuzzy filter. `data` is either:
 * - a plain value, replacing the cached entry wholesale — correct when the mutation's response
 *   carries the *full* value the query would otherwise fetch; or
 * - an updater `(old) => new`, for a query whose shape the response only partially covers (e.g. a
 *   joined field the mutation doesn't return, or a session detail extended with fields a
 *   sub-mutation doesn't touch) — mirrors `queryClient.setQueryData`'s own updater overload, and
 *   runs against whatever is currently cached (typically `undefined` if the query was never
 *   fetched).
 */
export function write(
    queryKey: QueryKey,
    data: unknown | ((old: unknown) => unknown),
): MutationEffect {
    return { type: "write", queryKey, data };
}

/**
 * Declares a query filter to invalidate after a mutation succeeds.
 *
 * Best suited to queries a single mutation response can't fully determine the new value of —
 * list/collection queries, where membership, sort order, or pagination may have changed. For a
 * single-entity query the mutation's response already *is* the new value — prefer `write()` for
 * those, so the UI updates instantly instead of waiting on a refetch.
 */
export function invalidate(filter: QueryFilters): MutationEffect {
    return { type: "invalidate", filter };
}

function isInvalidateEffect(
    effect: MutationEffect,
): effect is Extract<MutationEffect, { type: "invalidate" }> {
    return effect.type === "invalidate";
}

// Augments `@tanstack/query-core`, where `Register` is actually declared, rather than
// `@tanstack/react-query` (which only re-exports it) — augmenting the re-exporting module type-
// checks `meta: { effects: ... }` at `useMutation` call sites but silently fails to resolve
// `mutation.meta.effects` back to a callable type at the read site below.
declare module "@tanstack/query-core" {
    interface Register {
        mutationMeta: {
            /**
             * Cache side-effects to apply after this mutation succeeds, as a function of its
             * variables and result. Read and applied by `MutationInvalidator`: all `write()`
             * entries first (synchronous `setQueryData` calls), then all `invalidate()` entries
             * (may trigger a background refetch of any still-stale, still-active queries) —
             * regardless of the order they appear in the returned array.
             *
             * Build entries with `write()`/`invalidate()` from this module rather than the object
             * literal shape directly.
             */
            effects?: (variables: any, data: any) => MutationEffect[]; // eslint-disable-line @typescript-eslint/no-explicit-any
        };
    }
}

/**
 * Bridges tRPC mutations to cache side-effects declared on the mutation itself, rather than
 * repeated at every `useMutation` call site.
 *
 * Patches the shared `mutationCache`'s `onSuccess` once (chaining any previous handler, restored
 * on unmount) so any mutation carrying `meta.effects` gets its target queries updated
 * automatically — all `write()` entries first (synchronous cache overwrite), then all
 * `invalidate()` entries (may trigger a background refetch of any still-stale, still-active
 * queries). This runs and is awaited *before* a call site's own `onSuccess`, so ordering with
 * UI-level effects (toasts, `router.refresh()`) is unaffected.
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

            const effects = mutation.meta?.effects?.(variables, data) ?? [];

            for (const effect of effects) {
                if (effect.type === "write") queryClient.setQueryData(effect.queryKey, effect.data);
            }

            await Promise.all(
                effects
                    .filter(isInvalidateEffect)
                    .map((effect) => queryClient.invalidateQueries(effect.filter)),
            );
        };

        return () => {
            mutationCache.config.onSuccess = previousOnSuccess;
        };
    }, [queryClient]);

    return null;
}
