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
