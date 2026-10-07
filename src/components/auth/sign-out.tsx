/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import { signOut, useSession } from "@/client/auth-queries";
import { RainbowSpinner } from "@/components/ui/loading";
import { safeRedirectPath, SIGN_IN_PATH } from "@/lib/auth-redirect";

/**
 * The one place the app signs out. Every "Sign out" control navigates here (`signOutUrl()`)
 * instead of signing out in place, so the page it was on has unmounted before the session
 * goes, and none of its queries can refetch without one and log `UNAUTHORIZED`.
 *
 * Afterwards it does a full page load to `?redirectTo=` (validated; sign-in by default). The
 * query cache and the RSC router cache are browser singletons that survive client-side
 * navigation, and the reload is what clears the previous account's data out of both.
 * Awaiting `signOut` first matters: navigating before it resolves races the cookie clear.
 */
export function SignOut() {
    const { data: session, isPending } = useSession();
    const searchParams = useSearchParams();
    const destination = safeRedirectPath(searchParams.get("redirectTo")) ?? SIGN_IN_PATH;

    // The session flips to null as part of signing out, which would otherwise re-enter this
    // effect and fire a second sign-out.
    const startedRef = useRef(false);

    useEffect(() => {
        if (isPending || startedRef.current) return;
        startedRef.current = true;

        if (!session) {
            window.location.replace(destination);
            return;
        }

        void signOut().finally(() => window.location.replace(destination));
    }, [isPending, session, destination]);

    return <RainbowSpinner />;
}
