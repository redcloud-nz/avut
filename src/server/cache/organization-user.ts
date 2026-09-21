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
import prisma from "@/server/prisma";

import { organizationUserCacheTag } from "./organization-user-revalidate";

/**
 * Get a user's role(s) within an organization, or `null` if they aren't a member.
 *
 * Notes:
 * - The results are cached for performance with a cache tag of `organization-user-{user_id}`.
 * - The `user_id` parameter is not typed to allow easier integration with route parameters.
 * - Selects only the `role` column — callers that need the full membership record (name,
 *   email, personId, …) should query it directly rather than adding that join back here.
 *
 * Prefer `getOrganizationUserRoles` in a Server Component, where a missing membership should
 * render Next's not-found UI. This one is for callers outside rendering — e.g. a tRPC
 * procedure — that need to turn a missing membership into their own error instead.
 *
 * @param organizationId The ID of the organization.
 * @param user_id The ID of the user.
 * @returns The user's roles within the organization, or `null` if they have no membership.
 */
export async function getOrganizationUserRolesOrNull(
    organizationId: OrganizationId,
    user_id: string,
): Promise<OrganizationRole[] | null> {
    "use cache";
    cacheTag(organizationUserCacheTag(user_id));

    const orgUser = await prisma.organizationUser.findUnique({
        where: { organizationId_userId: { organizationId, userId: user_id } },
        select: { role: true },
    });

    if (!orgUser) return null;
    return z.array(OrganizationRole.schema).parse(orgUser.role.split(","));
}

/**
 * As `getOrganizationUserRolesOrNull`, but triggers Next's not-found response instead of
 * returning `null` when the user has no membership in the organization. Use this in a Server
 * Component; use the `OrNull` variant anywhere outside rendering.
 *
 * @param organizationId The ID of the organization.
 * @param user_id The ID of the user.
 * @returns The user's roles within the organization.
 */
export async function getOrganizationUserRoles(
    organizationId: OrganizationId,
    user_id: string,
): Promise<OrganizationRole[]> {
    const roles = await getOrganizationUserRolesOrNull(organizationId, user_id);
    if (!roles) return notFound();
    return roles;
}
