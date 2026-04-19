/*
 *  Copyright (c) A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { cacheTag, revalidateTag } from "next/cache";
import { notFound } from "next/navigation";

import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationUser } from "@/lib/schemas/organization-user";
import { UserId } from "@/lib/schemas/user";

import prisma from "./prisma";

/**
 * Get an organization user by their user ID;
 *
 * Notes:
 * - The results are cached for performance with a cache tag of `organization-user-{user_id}`.
 * - The `user_id` parameter is not typed to allow easier integration with route parameters.
 * - If the organization user is not found, a 404 response is triggered.
 *
 * @param organizationId The ID of the organization.
 * @param user_id The ID of the user.
 * @returns The organization user data along with the associated user data.
 */
export async function getOrganizationUserById(
    organizationId: OrganizationId,
    user_id: string,
): Promise<OrganizationUser> {
    "use cache";
    cacheTag(`organization-user-${user_id}`);

    // Fetch organization user record
    const orgUser = await prisma.organizationUser.findUnique({
        where: { organizationId_userId: { organizationId, userId: user_id } },
        include: { user: true },
    });

    if (!orgUser) return notFound();
    return OrganizationUser.fromRecord(orgUser.user, orgUser);
}

/**
 * Revalidate the cache for an organization user.
 * @param user_id The ID of the user.
 */
export async function revalidateOrganizationUser(user_id: UserId) {
    revalidateTag(`organization-user-${user_id}`, { expire: 0 });
}
