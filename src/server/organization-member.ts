/*
 *  Copyright (c) A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { cacheTag, revalidateTag } from "next/cache";
import { notFound } from "next/navigation";

import { OrganizationId } from "@/lib/schemas/organization";
import {
    OrganizationMemberData,
    OrganizationMemberId,
} from "@/lib/schemas/organization-member";
import { UserData } from "@/lib/schemas/user";

import prisma from "./prisma";

/**
 * Get an organization member (and the associated user) by their ID within an organization.
 *
 * Notes:
 * - The results are cached for performance with a cache tag of `organization-member-{orgMemberId}`.
 * - The `orgMemberId` parameter is not typed to allow easier integration with route parameters.
 * - If the organization member is not found, a 404 response is triggered.
 *
 * @param organizationId The ID of the organization.
 * @param orgMemberId The ID of the organization member.
 * @returns The organization member data along with the associated user data.
 */
export async function getOrganizationMemberById(
    organizationId: OrganizationId,
    orgMemberId: string,
): Promise<OrganizationMemberData & { user: UserData }> {
    "use cache";
    cacheTag(`organization-member-${orgMemberId}`);

    // Fetch organization member record
    const orgMember = await prisma.organizationMember.findUnique({
        where: { organizationId, id: orgMemberId },
        include: { user: true },
    });

    if (!orgMember) return notFound();

    return {
        ...OrganizationMemberData.fromRecord(orgMember),
        user: UserData.fromRecord(orgMember.user),
    };
}

/**
 * Revalidate the cache for an organization member.
 * @param orgMemberId The ID of the organization member.
 */
export async function revalidateOrganizationMember(
    orgMemberId: OrganizationMemberId,
) {
    revalidateTag(`organization-member-${orgMemberId}`, { expire: 0 });
}
