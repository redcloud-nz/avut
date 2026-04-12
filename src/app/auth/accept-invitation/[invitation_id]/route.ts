/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/invitations/[invitation_id]
 */

import { auth } from "@/server/auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
    request: NextRequest,
    context: RouteContext<"/auth/accept-invitation/[invitation_id]">,
) {
    const { invitation_id } = await context.params;

    const session = await auth.api.getSession({ headers: request.headers });

    // If the user is already signed in, sign them out before accepting the invitation, since we want to ensure they sign in with the correct account.
    if (session) await auth.api.signOut({ headers: request.headers });

    const url = session
        ? new URL("/auth/sign-in", request.url)
        : new URL("/auth/sign-up", request.url);

    const response = NextResponse.redirect(url);
    response.cookies.set({
        name: "avut.invitation_to_accept",
        value: invitation_id,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60, // 1 hour
    });

    return response;
}
