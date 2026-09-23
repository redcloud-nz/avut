/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 * Path: /auth/post-sign-in
 */

import { NextRequest, NextResponse } from "next/server";

import { safeRedirectPath } from "@/lib/auth-redirect";
import { route } from "@/lib/routes";
import { getEntryControl } from "@/server/entry-control";

export async function GET(request: NextRequest) {
    // `redirectTo` is user-controllable, so it must be validated before it is followed —
    // otherwise this is an open redirect.
    const redirectPath = safeRedirectPath(request.nextUrl.searchParams.get("redirectTo"));

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
