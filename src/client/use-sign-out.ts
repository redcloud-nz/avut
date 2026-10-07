/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import type { Route } from "next";
import { useCallback } from "react";

import { signOut } from "@/client/auth-queries";
import { SIGN_IN_PATH } from "@/lib/auth-redirect";

/**
 * Sign out and tear down every cache holding the previous account's data.
 *
 * `getQueryClient()` returns a browser singleton that survives client-side navigation, as does
 * the RSC router cache, so the previous account's data has to go. A full page load does that
 * in one step. Clearing the query cache in place doesn't work: the current page's queries are
 * still mounted and refetch straight away, now without a session, and each one logs
 * `UNAUTHORIZED` on the server (the same reason `window.avut.signOut` in
 * `src/client/dev-tools.ts` reloads).
 *
 * Awaiting `signOut` matters too — navigating first races the cookie clear.
 *
 * @param destination Where to go afterwards. Defaults to the sign-in page; pass the current path
 *   to stay put (e.g. the invitation landing page, which renders differently once signed out).
 */
export function useSignOut(destination: Route = SIGN_IN_PATH) {
    return useCallback(async () => {
        await signOut();

        window.location.replace(destination);
    }, [destination]);
}
