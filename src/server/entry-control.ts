/*
 *  Copyright (c) 2025 A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 *
 */

import { headers as nextHeaders } from "next/headers";

import { OrganizationData } from "@/lib/schemas/organization";
import { OrganizationInvitationData } from "../lib/schemas/organization-invitation";
import { OrganizationMembershipData } from "@/lib/schemas/organization-member";

import { auth, AuthSession } from "@/server/auth";
import prisma from "@/server/prisma";

export interface EntryControlProceed {
    status: "Proceed";
    slug: string;
    data?: never;
}

export interface EntryControlSelect {
    status: "Select";
    slug?: never;
    data: {
        session: AuthSession;
        memberships: (OrganizationMembershipData & {
            organization: OrganizationData;
        })[];
        invitations: (OrganizationInvitationData & {
            organization: OrganizationData;
        })[];
    };
}
export type EntryControl = EntryControlProceed | EntryControlSelect;

export async function getEntryControl(): Promise<EntryControl> {
    const headers = await nextHeaders();
    const session = await auth.api.getSession({ headers });

    if (!session) throw new Error("User is not authenticated");

    const [memberships, invitations] = await Promise.all([
        await prisma.organizationUser.findMany({
            where: {
                userId: session.user.id,
            },
            include: {
                organization: true,
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

    if (memberships.length == 1 && invitations.length == 0) {
        // User only has one organization and no pending invitations, proceed directly to that org
        return {
            status: "Proceed",
            slug: memberships[0].organization.slug,
        };
    }

    return {
        status: "Select",
        data: {
            session,
            memberships: memberships.map((membership) => ({
                ...OrganizationMembershipData.fromRecord(membership),
                organization: OrganizationData.fromRecord(membership.organization),
            })),
            invitations: invitations.map((invitation) => ({
                ...OrganizationInvitationData.fromRecord(invitation),
                organization: OrganizationData.fromRecord(invitation.organization),
            })),
        },
    };
}
