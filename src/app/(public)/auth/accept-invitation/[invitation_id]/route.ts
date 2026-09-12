/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/accept-invitation/[invitation_id]
 */

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/server/auth";
import prisma from "@/server/prisma";

export async function GET(
    request: NextRequest,
    context: RouteContext<"/auth/accept-invitation/[invitation_id]">,
) {
    const { invitation_id } = await context.params;

    const invitation = await prisma.organizationInvitation.findUnique({
        where: { id: invitation_id, status: "pending" },
    });
    if (!invitation)
        return NextResponse.json(
            { error: "Invitation not found or already accepted." },
            { status: 404 },
        );

    const user = await prisma.user.findUnique({ where: { email: invitation.email } });

    const session = await auth.api.getSession({ headers: request.headers });

    // If the user is already signed in, sign them out before accepting the invitation, since we want to ensure they sign in with the correct account.
    if (session) await auth.api.signOut({ headers: request.headers });

    // Redirect to sign in or sign up page with the invitation email pre-filled, and set a cookie to indicate which invitation is being accepted.
    const url =
        session || user
            ? new URL(`/auth/sign-in?email=${encodeURIComponent(invitation.email)}`, request.url)
            : new URL(`/auth/sign-up?email=${encodeURIComponent(invitation.email)}`, request.url);

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
