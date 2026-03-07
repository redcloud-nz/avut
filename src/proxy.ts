/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */

import { getSessionCookie } from "better-auth/cookies";
import { NextRequest, NextResponse } from "next/server";

export default async function proxy(request: NextRequest) {
    const sessionCookie = getSessionCookie(request);

    // if (!sessionCookie)
    //     return NextResponse.redirect(new URL("/auth/sign-in", request.url));

    return NextResponse.next();
}

export const config = {
    // Match all pathnames except for
    // - … if they start with `/api`, `/trpc`, `/_next` or `/_vercel`
    // - … the ones containing a dot (e.g. `favicon.ico`)
    matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
