/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/post-sign-in
 */

import { cookies as nextCookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/server/auth";
import prisma from "@/server/prisma";

export async function GET(request: NextRequest) {
    // Check for a redirect cookie set by the sign-in page, and if it exists, redirect to that and clear the cookie
    const cookies = await nextCookies();

    const redirectPath = cookies.get("avut.post_sign_in_redirect")?.value;
    const invitationId = cookies.get("avut.invitation_to_accept")?.value;

    if (invitationId) {
        const invitation = await prisma.organizationInvitation.findUnique({
            where: { id: invitationId, status: "pending" },
        });
        if (invitation) {
            // If the invitation is valid, accept it
            await auth.api.acceptInvitation({
                body: { invitationId },
                headers: request.headers,
            });
        }
    }

    if (redirectPath) {
        const redirectUrl = new URL(redirectPath, request.url);
        cookies.delete("avut.post_sign_in_redirect");
        return NextResponse.redirect(redirectUrl);
    }

    // Default redirect to the dashboard page.
    return NextResponse.redirect(new URL("/main", request.url));
}
