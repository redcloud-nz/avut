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
 * Redirects to sign-in if the session is revoked or expires while the user is already on a
 * page. Renders nothing itself.
 *
 * The server-side guards (`requireSession` / `requireOrganization`) protect first paint but
 * cannot react after load. This is the other half: nothing polls, but React Query's normal
 * refetch triggers — window focus, reconnect, stale-time expiry on navigation, explicit
 * invalidation — will notice and drive the redirect.
 */
export function SessionWatcher() {
    const router = useRouter();
    const { data, isPending, error } = useSession();

    useEffect(() => {
        // The `error` guard is deliberate. An errored query has `data === undefined` and
        // `status === "error"`, so without it a terminal *network* failure — not an auth
        // failure — would eject the user to sign-in. avut is an internal tool where offline
        // blips are plausible, so a failed refetch leaves the user where they are.
        if (data || isPending || error) return;

        router.replace(signInUrl(window.location.pathname + window.location.search));
    }, [data, isPending, error, router]);

    return null;
}
