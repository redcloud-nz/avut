/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * /auth/post-sign-in
 */

import { cookies as nextCookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    // Check for a redirect cookie set by the sign-in page, and if it exists, redirect to that and clear the cookie
    const cookies = await nextCookies();

    const redirectPath = cookies.get("avut.post_sign_in_redirect")?.value;
    if (redirectPath) {
        const redirectUrl = new URL(redirectPath, request.url);
        cookies.delete("avut.post_sign_in_redirect");
        return NextResponse.redirect(redirectUrl);
    }

    // Default redirect to the dashboard page.
    return NextResponse.redirect(new URL("/main", request.url));
}
