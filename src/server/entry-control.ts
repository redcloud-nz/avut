/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

import { OrganizationData } from "@/lib/schemas/organization";
import { OrganizationInvitationData } from "@/lib/schemas/organization-invitation";
import { OrganizationUser } from "@/lib/schemas/organization-user";

import { AuthSession } from "@/server/auth";
import prisma from "@/server/prisma";
import { requireSession } from "@/server/session";

export interface OrganizationMembershipsAndInvitations {
    session: AuthSession;
    memberships: (OrganizationUser & {
        organization: OrganizationData;
    })[];
    invitations: (OrganizationInvitationData & {
        organization: OrganizationData;
    })[];
}

export interface EntryControlProceed {
    status: "Proceed";
    slug: string;
    data?: never;
}

export interface EntryControlSelect {
    status: "Select";
    slug?: never;
    data: OrganizationMembershipsAndInvitations;
}
export type EntryControl = EntryControlProceed | EntryControlSelect;

/** The personal dashboard's own data — every account gets it, regardless of membership count. */
export async function getOrganizationMembershipsAndInvitations(): Promise<OrganizationMembershipsAndInvitations> {
    const session = await requireSession();

    const [memberships, invitations] = await Promise.all([
        await prisma.organizationUser.findMany({
            where: {
                userId: session.user.id,
            },
            include: {
                organization: true,
                user: true,
            },
        }),
        await prisma.organizationInvitation.findMany({
            where: {
                email: session.user.email,
                status: "pending",
            },
            include: {
                organization: true,
            },
        }),
    ]);

    return {
        session,
        memberships: memberships.map((membership) => ({
            ...OrganizationUser.fromRecord(membership.user, membership),
            organization: OrganizationData.fromRecord(membership.organization),
        })),
        invitations: invitations.map((invitation) => ({
            ...OrganizationInvitationData.fromRecord(invitation),
            organization: OrganizationData.fromRecord(invitation.organization),
        })),
    };
}

/**
 * The single-org shortcut for landing pages (post-sign-in, `/orgs`) — never called by `/user`
 * itself, which always renders the dashboard so it's a real destination rather than a bounce.
 */
export async function getEntryControl(): Promise<EntryControl> {
    const data = await getOrganizationMembershipsAndInvitations();

    if (data.memberships.length == 1 && data.invitations.length == 0) {
        // User only has one organization and no pending invitations, proceed directly to that org
        return {
            status: "Proceed",
            slug: data.memberships[0].organization.slug,
        };
    }

    return { status: "Select", data };
}
