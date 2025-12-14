/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

//import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

//const isPublicRoute = createRouteMatcher(['/', '/about', '/api/webhooks(.*)','/contact', '/privacy-policy', '/sign-in', '/sign-up', '/terms-of-service'])

export async function proxy(request: NextRequest) {
    const sessionCookie = getSessionCookie(request);

    if (!sessionCookie)
        return NextResponse.redirect(new URL("/auth/sign-in", request.url));

    return NextResponse.next();
}

export const config = {
    matcher: ["/orgs(.*)", "/(trpc)(.*)"],
};
