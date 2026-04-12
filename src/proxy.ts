/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    if (
        pathname == "/" ||
        pathname.startsWith("/auth") ||
        pathname.startsWith("/policies") ||
        pathname.startsWith("/public")
    ) {
        // Public routes that don't require authentication, allow through
        return NextResponse.next();
    } else {
        // Secure routes
        const sessionCookie = getSessionCookie(request);

        if (sessionCookie) {
            // Session exists
            return NextResponse.next();
        } else {
            // No session

            const signInUrl = new URL("/auth/sign-in", request.url);

            // Set the redirect cookie so that after signing in, the user is redirected back to the page they were trying to access
            const response = NextResponse.redirect(signInUrl);
            response.cookies.set({
                name: "avut.post_sign_in_redirect",
                value: pathname,
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                maxAge: 60 * 60, // 1 hour
            });
            return response;
        }
    }
}

export const config = {
    // Match all pathnames except for
    // - … if they start with `/api`, `/trpc`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
