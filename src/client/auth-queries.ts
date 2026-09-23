/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

import { queryOptions, useQuery } from "@tanstack/react-query";

import { authClient } from "@/client/auth-client";
import { authQueryKeys } from "@/lib/auth-query-keys";
import { trpc, type RouterOutput } from "@/trpc/client";

/** The shape `useSession()`/`useUser()` resolve to — `trpc.users.getSession`'s output. */
export type SessionData = NonNullable<RouterOutput["users"]["getSession"]>;

/**
 * The single definition of the session query.
 *
 * Goes through `trpc.users.getSession` rather than `authClient.getSession()` directly, so it
 * shares tRPC's prefetch/hydrate machinery with every other query instead of needing its own
 * hand-aligned server/client key pair — `AuthenticatedLayout` prefetches the same procedure,
 * and the shared queryKey `queryOptions()` derives is what lets that hydrate this entry
 * instead of this query re-fetching on mount.
 */
export function sessionQueryOptions() {
    return queryOptions({
        ...trpc.users.getSession.queryOptions(),
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}

/**
 * Read the current session.
 *
 * Prefer this over Better Auth's own `authClient.useSession()`, which keeps its own
 * nanostore cache with no relationship to React Query — a second copy of the session that
 * goes stale independently, cannot be hydrated from the server, and survives sign-out.
 */
export function useSession() {
    return useQuery(sessionQueryOptions());
}

/** Read the current user, if any. */
export function useUser() {
    const { data, ...rest } = useSession();
    return { ...rest, data: data?.user };
}

/**
 * The single definition of the linked-accounts query.
 *
 * Both `UserProfile_ChangePassword_Dialog` (which only needs to know whether a credential
 * account exists) and `LinkedAccounts_Card` read through this, so the two share one cache
 * entry and one request rather than each fetching the list.
 *
 * The key sits inside the `["auth"]` subtree so it inherits `authQueryRetryOptions` — a
 * 403 from a stale session fails fast instead of burning three pointless retries — and is
 * evicted along with the rest of the auth cache on sign-out.
 */
export function linkedAccountsQueryOptions() {
    return queryOptions({
        queryKey: authQueryKeys.linkedAccounts,
        queryFn: ({ signal }) => listAccounts(signal),
    });
}

// Named separately so `LinkedAccount` below can be derived from it rather than hand-rolled.
function listAccounts(signal?: AbortSignal) {
    // `throw: true` rejects on error and resolves with the accounts themselves rather than
    // Better Auth's `{ data, error }` envelope.
    return authClient.listAccounts({}, { signal, throw: true });
}

/** One account linked to the current user, as returned by Better Auth's `/list-accounts`. */
export type LinkedAccount = Awaited<ReturnType<typeof listAccounts>>[number];
