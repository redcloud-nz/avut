/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

import { SIGN_IN_PATH } from "@/lib/auth-redirect";
import { CURRENT_PATH_HEADER } from "@/lib/constants";

export async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;
    const currentPath = pathname + request.nextUrl.search;

    // Expose the current path to server components so `requireSession()` can build a
    // sign-in URL that returns the user here. `set` (never `append`) so a client-supplied
    // header of the same name is always overwritten.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(CURRENT_PATH_HEADER, currentPath);

    const proceed = () => NextResponse.next({ request: { headers: requestHeaders } });

    if (
        pathname == "/" ||
        pathname.startsWith("/auth") ||
        pathname.startsWith("/policies") ||
        pathname.startsWith("/public")
    ) {
        // Public routes that don't require authentication, allow through
        return proceed();
    } else {
        // Secure routes.
        //
        // NOTE: this is a cookie *presence* check only — it does not validate the session.
        // It is an optimistic gate to save a round trip; the real check is `requireSession()`
        // in the layouts and pages themselves.
        const sessionCookie = getSessionCookie(request);

        if (sessionCookie) {
            // Session cookie exists
            return proceed();
        } else {
            // No session — send them to sign in, preserving where they were headed.
            const signInUrl = new URL(SIGN_IN_PATH, request.url);
            signInUrl.searchParams.set("redirectTo", currentPath);
            return NextResponse.redirect(signInUrl);
        }
    }
}

export const config = {
    // Match all pathnames except for
    // - … if they start with `/api`, `/trpc`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
