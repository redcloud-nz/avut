/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/post-sign-in
 */

import { cookies as nextCookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { safeRedirectPath } from "@/lib/auth-redirect";
import { auth } from "@/server/auth";
import prisma from "@/server/prisma";

export async function GET(request: NextRequest) {
    const cookies = await nextCookies();

    // `redirectTo` is user-controllable, so it must be validated before it is followed —
    // otherwise this is an open redirect.
    const redirectPath = safeRedirectPath(request.nextUrl.searchParams.get("redirectTo"));
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
        cookies.delete("avut.invitation_to_accept");
    }

    if (redirectPath) {
        return NextResponse.redirect(new URL(redirectPath, request.url));
    }

    // Default redirect to the dashboard page.
    return NextResponse.redirect(new URL("/orgs/--select-org", request.url));
}
