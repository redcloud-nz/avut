/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

import { queryOptions, useQuery } from "@tanstack/react-query";

import { authClient, AuthClientSession } from "@/client/auth-client";
import { authQueryKeys } from "@/lib/auth-query-keys";

/**
 * The single definition of the session query.
 *
 * Unwraps to the session itself rather than Better Auth's `{ data, error }` envelope —
 * everything downstream wants the session. The key matches the server-side factory in
 * `@/server/auth-queries`, which is what lets a server component hydrate this entry.
 */
export function sessionQueryOptions() {
    return queryOptions({
        queryKey: authQueryKeys.session,
        // `throw: true` makes better-fetch reject on error and resolve with the session
        // itself rather than a `{ data, error }` envelope.
        queryFn: async ({ signal }): Promise<AuthClientSession | null> => {
            const session = await authClient.getSession({
                fetchOptions: { signal, throw: true },
            });
            return session ?? null;
        },
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
 * Both `UserSecuritySettings` (which only needs to know whether a credential account
 * exists) and `LinkedAccounts_Card` read through this, so the two share one cache entry
 * and one request rather than each fetching the list.
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
