/*
 *  Copyright (c) A.V.U.T. Project.
 *  Licensed under the MIT License. See LICENSE.md in the project root for license information.
 */
import "server-only";

import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import * as z from "zod";

import { OrganizationId } from "@/lib/schemas/organization";
import { OrganizationRole } from "@/lib/schemas/organization-role";

import { organizationUserCacheTag } from "./organization-user-cache";
import prisma from "./prisma";

/**
 * Get a user's role(s) within an organization.
 *
 * Notes:
 * - The results are cached for performance with a cache tag of `organization-user-{user_id}`.
 * - The `user_id` parameter is not typed to allow easier integration with route parameters.
 * - If the organization user is not found, a 404 response is triggered.
 * - Selects only the `role` column — callers that need the full membership record (name,
 *   email, personId, …) should query it directly rather than adding that join back here.
 *
 * @param organizationId The ID of the organization.
 * @param user_id The ID of the user.
 * @returns The user's roles within the organization.
 */
export async function getOrganizationUserRoles(
    organizationId: OrganizationId,
    user_id: string,
): Promise<OrganizationRole[]> {
    "use cache";
    cacheTag(organizationUserCacheTag(user_id));

    const orgUser = await prisma.organizationUser.findUnique({
        where: { organizationId_userId: { organizationId, userId: user_id } },
        select: { role: true },
    });

    if (!orgUser) return notFound();
    return z.array(OrganizationRole.schema).parse(orgUser.role.split(","));
}
