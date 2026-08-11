/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { QueryClient, queryOptions } from "@tanstack/react-query";

import { authQueryKeys } from "@/lib/auth-query-keys";

import { getSession } from "./session";

/**
 * Server-side flavour of the session query: same key as the client definition in
 * `@/client/auth-queries`, but resolved directly rather than over HTTP back into this app.
 *
 * The shared key is the entire trick — it is what lets a dehydrated server cache satisfy a
 * client `useSession()` without a refetch.
 */
export function serverSessionQueryOptions() {
    return queryOptions({
        queryKey: authQueryKeys.session,
        queryFn: () => getSession(),
    });
}

/**
 * Seed a query client with the current session, ready to be dehydrated into a
 * `<HydrationBoundary>`.
 *
 * `getSession` is React `cache`-deduped and any guard on the same request has already
 * called it, so this costs nothing beyond writing the cache entry.
 */
export function ensureSession(queryClient: QueryClient) {
    return queryClient.ensureQueryData(serverSessionQueryOptions());
}
