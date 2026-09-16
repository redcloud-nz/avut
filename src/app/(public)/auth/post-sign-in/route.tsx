/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/post-sign-in
 */

import { cookies as nextCookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import { safeRedirectPath } from "@/lib/auth-redirect";
import { route } from "@/lib/routes";
import { auth } from "@/server/auth";
import { getEntryControl } from "@/server/entry-control";
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

    // No explicit destination: proceed straight to the org for a single-org account, otherwise
    // land on the personal dashboard to pick one.
    const entryControl = await getEntryControl();
    const destination =
        entryControl.status === "Proceed"
            ? route("/orgs/[slug]", { slug: entryControl.slug })
            : "/user";
    return NextResponse.redirect(new URL(destination, request.url));
}
