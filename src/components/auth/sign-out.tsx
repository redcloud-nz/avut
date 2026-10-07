/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { signOut, useSession } from "@/client/auth-queries";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RainbowSpinner } from "@/components/ui/loading";
import { safeRedirectPath, SIGN_IN_PATH } from "@/lib/auth-redirect";

/**
 * The one place the app's controls sign out. Every "Sign out" control navigates here
 * (`signOutUrl()`) instead of signing out in place, so the page it was on has unmounted before
 * the session goes, and none of its queries can refetch without one and log `UNAUTHORIZED`.
 *
 * On success it does a full page load to `?redirectTo=` (validated; sign-in by default). The
 * query cache and the RSC router cache are browser singletons that survive client-side
 * navigation, and the reload is what clears the previous account's data out of both. It
 * navigates only once the sign-out has succeeded: landing on the sign-in page with the cookie
 * still live would look signed out on a shared machine while it isn't.
 */
export function SignOut() {
    const { data: session, isPending, error: sessionError } = useSession();
    const searchParams = useSearchParams();
    const destination = safeRedirectPath(searchParams.get("redirectTo")) ?? SIGN_IN_PATH;

    const [failed, setFailed] = useState(false);

    // The session flips to null as part of signing out, which would otherwise re-enter this
    // effect and fire a second sign-out.
    const startedRef = useRef(false);

    const run = useCallback(async () => {
        setFailed(false);
        try {
            // Better Auth reports failure in the envelope rather than by rejecting.
            const { error } = await signOut();
            if (error) throw error;
        } catch {
            setFailed(true);
            return;
        }
        window.location.replace(destination);
    }, [destination]);

    useEffect(() => {
        if (isPending || startedRef.current) return;
        startedRef.current = true;

        // Only a session that's confirmed absent skips the sign-out. If the session check
        // itself failed, sign out anyway: it's harmless without a session.
        if (!session && !sessionError) {
            window.location.replace(destination);
            return;
        }

        void run();
    }, [isPending, session, sessionError, destination, run]);

    if (failed) {
        return (
            <Alert variant="error">
                <AlertTitle>Couldn&apos;t sign you out</AlertTitle>
                <AlertDescription>
                    <p>You&apos;re still signed in. Check your connection and try again.</p>
                    <Button className="mt-2" variant="outline" onClick={() => void run()}>
                        Try again
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    return <RainbowSpinner />;
}
