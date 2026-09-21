/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useEffect } from "react";

import {
    type InferDataFromTag,
    type QueryClient,
    type QueryFilters,
    type QueryKey,
    type Updater,
} from "@tanstack/react-query";

import type { RouterInput, RouterOutput } from "@/trpc/routers/_app";

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
 * an exact `queryKey`, not a fuzzy filter. `queryKey` must come from a tRPC `.queryKey(...)` call
 * (or anything else `DataTag`-branded) — that's what lets `data` type-check against the query's
 * *actual* data type here, the same way it would for a direct `queryClient.setQueryData(...)`
 * call. `data` is either:
 * - a plain value, replacing the cached entry wholesale — correct when the mutation's response
 *   carries the *full* value the query would otherwise fetch; or
 * - an updater `(old) => new`, for a query whose shape the response only partially covers (e.g. a
 *   joined field the mutation doesn't return, or a session detail extended with fields a
 *   sub-mutation doesn't touch) — mirrors `queryClient.setQueryData`'s own updater overload, and
 *   runs against whatever is currently cached (typically `undefined` if the query was never
 *   fetched).
 *
 * The `MutationEffect` this returns still erases `data` back to `unknown` — a `meta.effects` array
 * mixes writes to unrelated queries, so it can't carry a single non-`unknown` element type — but
 * that erasure happens *after* this call's arguments are checked against each other.
 */
export function write<
    TTaggedQueryKey extends QueryKey,
    TData = InferDataFromTag<unknown, TTaggedQueryKey>,
>(
    queryKey: TTaggedQueryKey,
    // NoInfer here matches `setQueryData`'s own signature and matters for the same reason: without
    // it, TS would infer TData from whatever `data` happens to be, defeating the check entirely —
    // TData needs to come solely from `queryKey`'s tag, with `data` then checked against it.
    data: Updater<NoInfer<TData> | undefined, NoInfer<TData> | undefined>,
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
 *
 * By default this awaits a refetch of every matching query that is currently mounted. A mutation
 * whose `onSuccess` navigates away should set `meta.navigates` so it only marks them stale.
 */
export function invalidate(filter: QueryFilters): MutationEffect {
    return { type: "invalidate", filter };
}

function isInvalidateEffect(
    effect: MutationEffect,
): effect is Extract<MutationEffect, { type: "invalidate" }> {
    return effect.type === "invalidate";
}

function isWriteEffect(
    effect: MutationEffect,
): effect is Extract<MutationEffect, { type: "write" }> {
    return effect.type === "write";
}

type EffectsFn<TVars, TData> = (vars: TVars, data: TData) => MutationEffect[];

/**
 * Builds a `<domain>Effects` object for one router's procedures, keyed by procedure name, without
 * each `<domain>-effects.ts` file needing to import `RouterInput`/`RouterOutput` itself.
 *
 * `createEffects<"teams">()({ updateTeam: (vars, { updated }) => [...] })` infers `vars`/`data` for
 * every entry from that router's actual input/output types — same as writing
 * `(vars: RouterInput["teams"]["updateTeam"], data: RouterOutput["teams"]["updateTeam"]) => ...` by
 * hand, just without naming either type. Only declare the procedures that need effects; the rest of
 * the router's procedures are omitted, not required.
 *
 * Takes `TRouter` as its own call — `createEffects<"teams">()` — because a type parameter with
 * nothing to infer it from a runtime argument has to be given explicitly, and a function can't take
 * an explicit type argument for just one of its parameters while inferring the rest.
 */
export function createEffects<TRouter extends keyof RouterInput & keyof RouterOutput>() {
    return function <
        TEffects extends {
            [K in keyof RouterInput[TRouter]]?: EffectsFn<
                RouterInput[TRouter][K],
                RouterOutput[TRouter][K]
            >;
        },
    >(effects: TEffects): TEffects {
        return effects;
    };
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
             * variables and result. Read and applied by `useMutationEffector`: all `write()`
             * entries first (synchronous `setQueryData` calls), then all `invalidate()` entries
             * (may trigger a background refetch of any still-stale, still-active queries) —
             * regardless of the order they appear in the returned array.
             *
             * Build entries with `write()`/`invalidate()` from this module rather than the object
             * literal shape directly.
             */
            effects?: (variables: any, data: any) => MutationEffect[]; // eslint-disable-line @typescript-eslint/no-explicit-any
            /**
             * Set this on a mutation whose own `onSuccess` navigates away (a create that
             * redirects to the new record, a delete that returns to the list).
             *
             * The effector runs — and is awaited — before that `onSuccess`, and an `invalidate()`
             * effect normally awaits a real refetch of every matching query that is still
             * mounted. For a navigating mutation those are the queries on the page being left, so
             * the redirect (and the button's spinner) would wait on a round trip nobody will see —
             * and, after a delete, on refetching the very record that no longer exists. With this
             * flag the effects still mark those queries stale, so they refetch the next time they
             * are used, but nothing is fetched in the meantime.
             *
             * Queries that stay mounted across the navigation (a layout or sidebar query) are not
             * refetched until their next trigger either, so don't set this for a mutation whose
             * effects have to refresh something the destination page shows straight away.
             */
            navigates?: boolean;
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
 * Call once with the same `QueryClient` instance passed to `QueryClientProvider` — typically
 * right alongside it, since this patches that client's shared mutation cache.
 */
export function useMutationEffector(queryClient: QueryClient) {
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
                if (isWriteEffect(effect)) queryClient.setQueryData(effect.queryKey, effect.data);
            }

            // A navigating mutation marks queries stale without awaiting a refetch of them.
            const refetchType = mutation.meta?.navigates ? ("none" as const) : undefined;

            await Promise.all(
                effects
                    .filter(isInvalidateEffect)
                    .map((effect) =>
                        queryClient.invalidateQueries({ ...effect.filter, refetchType }),
                    ),
            );
        };

        return () => {
            mutationCache.config.onSuccess = previousOnSuccess;
        };
    }, [queryClient]);
}
