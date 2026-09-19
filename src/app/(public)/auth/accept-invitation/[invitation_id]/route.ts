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

    // Redirect to sign in or sign up page with the invitation email pre-filled. Accepting is left to
    // the invitations card on `/user`, which is where signing in lands.
    const email = encodeURIComponent(invitation.email);
    const url =
        session || user
            ? new URL(
                  `/auth/sign-in?email=${email}&redirectTo=${encodeURIComponent("/user")}`,
                  request.url,
              )
            : new URL(`/auth/sign-up?email=${email}`, request.url);

    return NextResponse.redirect(url);
}
