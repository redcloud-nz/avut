/*
 *  Copyright (c) 2026 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSession } from "@/client/auth-queries";
import { signInUrl } from "@/lib/auth-redirect";

/**
 * Redirect to sign-in if the session goes away while the user is on the page.
 *
 * The server-side guards (`requireSession` / `requireOrganization`) protect first paint but
 * cannot react after load. This is the other half: nothing polls, but React Query's normal
 * refetch triggers — window focus, reconnect, stale-time expiry on navigation, explicit
 * invalidation — will notice a revoked or expired session and drive the redirect.
 *
 * Returns the full query result so callers can still render a spinner while pending.
 */
export function useAuthenticate() {
    const router = useRouter();
    const session = useSession();

    const { data, isPending, error } = session;

    useEffect(() => {
        // The `error` guard is deliberate. An errored query has `data === undefined` and
        // `status === "error"`, so without it a terminal *network* failure — not an auth
        // failure — would eject the user to sign-in. avut is an internal tool where offline
        // blips are plausible, so a failed refetch leaves the user where they are.
        if (data || isPending || error) return;

        router.replace(signInUrl(window.location.pathname + window.location.search));
    }, [data, isPending, error, router]);

    return session;
}
