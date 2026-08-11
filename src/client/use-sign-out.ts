/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

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
 */
export function useSignOut() {
    const router = useRouter();

    return useCallback(async () => {
        await authClient.signOut();

        getQueryClient().clear();

        router.replace(SIGN_IN_PATH);
        router.refresh();
    }, [router]);
}
