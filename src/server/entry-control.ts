/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

import "server-only";

import prisma from "@/server/prisma";
import { requireSession } from "@/server/session";

export interface EntryControlProceed {
    status: "Proceed";
    slug: string;
}

export interface EntryControlSelect {
    status: "Select";
}

export type EntryControl = EntryControlProceed | EntryControlSelect;

/**
 * The single-org shortcut for landing pages (post-sign-in, `/orgs`) — never called by `/user`
 * itself, which always renders the dashboard (fetching its own data over tRPC) so it's a real
 * destination rather than a bounce.
 */
export async function getEntryControl(): Promise<EntryControl> {
    const session = await requireSession();

    const [memberships, hasPendingInvitation] = await Promise.all([
        // `take: 2` is enough to distinguish "exactly one" from "more than one" without a
        // separate count query, and the only field either caller needs is the slug.
        prisma.organizationUser.findMany({
            where: { userId: session.user.id },
            take: 2,
            select: { organization: { select: { slug: true } } },
        }),
        prisma.organizationInvitation
            .count({
                where: { email: session.user.email, status: "pending" },
            })
            .then((count) => count > 0),
    ]);

    if (memberships.length == 1 && !hasPendingInvitation) {
        // User only has one organization and no pending invitations, proceed directly to that org
        return { status: "Proceed", slug: memberships[0].organization.slug };
    }

    return { status: "Select" };
}
