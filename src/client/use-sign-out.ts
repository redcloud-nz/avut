/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { authClient } from "@/client/auth-client";
import { SIGN_IN_PATH } from "@/lib/auth-redirect";
import { getQueryClient } from "@/trpc/query-client";

/**
 * Sign out and tear down every cache holding the previous account's data.
 *
 * `getQueryClient()` returns a browser singleton that survives navigation, so without an
 * explicit teardown every org-scoped tRPC result from the previous account is still in
 * memory when the next user signs in on the same tab. `router.refresh()` does the same for
 * the client-side RSC cache.
 *
 * Awaiting `signOut` matters too — navigating first races the cookie clear.
 *
 * @param destination Where to go afterwards. Defaults to the sign-in page; pass the current path
 *   to stay put (e.g. the invitation landing page, which renders differently once signed out).
 */
export function useSignOut(destination: Route = SIGN_IN_PATH) {
    const router = useRouter();

    return useCallback(async () => {
        await authClient.signOut();

        getQueryClient().clear();

        router.replace(destination);
        router.refresh();
    }, [router, destination]);
}
